/**
 * Reads the text out of a PDF, in a worker thread.
 *
 * Why a separate thread, and why plain JavaScript:
 *  - A slow or hostile PDF can only tie up this thread. The server keeps
 *    answering, and pdf-text.ts can stop this thread on a timeout.
 *  - pdf.js ships only as an ES module. The server and its tests are
 *    CommonJS, and Jest cannot load an ES module that way. A worker is
 *    started by Node itself, so the import below just works everywhere.
 *
 * This file only reports where each piece of text sits on each page.
 * Turning that into lines happens in pdf-text.ts, where it can be tested.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { getDocumentProxy } from 'unpdf';

async function read({ bytes, maxPages }) {
  // verbosity 0: errors only, so damaged fonts do not flood the server log.
  const pdf = await getDocumentProxy(new Uint8Array(bytes), { verbosity: 0 });
  try {
    if (pdf.numPages > maxPages) {
      return { ok: false, name: 'TooManyPages', pageCount: pdf.numPages };
    }

    const pages = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      pages.push(
        content.items
          // Marked-content entries carry no text, only structure.
          .filter((item) => typeof item.str === 'string')
          .map((item) => ({
            str: item.str,
            x: item.transform[4],
            y: item.transform[5],
            width: item.width,
            // The font size, from the text matrix's vertical scale.
            size: Math.hypot(item.transform[2], item.transform[3]) || item.height,
          }))
      );
      page.cleanup();
    }
    return { ok: true, pageCount: pdf.numPages, pages };
  } finally {
    // pdf.js 6 moved destroy() from the document to its loading task.
    // The thread is stopped right after this anyway; this just frees memory sooner.
    await (pdf.loadingTask?.destroy?.() ?? pdf.destroy?.());
  }
}

read(workerData).then(
  (result) => parentPort.postMessage(result),
  (error) =>
    parentPort.postMessage({
      ok: false,
      name: error && typeof error.name === 'string' ? error.name : 'Error',
      message: error && typeof error.message === 'string' ? error.message : String(error),
    })
);
