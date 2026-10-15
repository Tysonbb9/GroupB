import path from 'node:path';
import { Worker } from 'node:worker_threads';

/**
 * Turns an uploaded syllabus PDF into plain text, one line per line on the
 * page, so the client's syllabus scanner can read it.
 *
 * The PDF itself is opened in read-pdf.worker.mjs. Everything here is about
 * what to trust and how to put the pieces back together:
 *
 *  - refuse what is not a PDF, too big, too long, locked, or takes too long
 *  - rebuild lines from where each piece of text sits on the page
 *  - tidy the text (ligatures, invisible characters, odd spaces)
 *  - say plainly when a PDF has no text at all, which usually means it is a
 *    scanned image and needs pasting in instead
 */

export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 50;
export const READ_TIMEOUT_MS = 15_000;

export type PdfLimits = {
  maxBytes: number;
  maxPages: number;
  timeoutMs: number;
};

const DEFAULT_LIMITS: PdfLimits = {
  maxBytes: MAX_PDF_BYTES,
  maxPages: MAX_PDF_PAGES,
  timeoutMs: READ_TIMEOUT_MS,
};

/** One run of text as pdf.js reports it: its string and where it starts. */
export type PdfTextItem = {
  str: string;
  /** Left edge, in points from the left of the page. */
  x: number;
  /** Baseline, in points from the bottom of the page. */
  y: number;
  /** How wide the run is, in points. */
  width: number;
  /** Font size in points. */
  size: number;
};

export type PdfText = {
  /** Every line of every page, in reading order, separated by "\n". */
  text: string;
  pageCount: number;
  lineCount: number;
  /** Pages with no text on them, numbered from 1. Usually scanned images. */
  pagesWithoutText: number[];
};

export type PdfErrorCode =
  | 'empty'
  | 'too_large'
  | 'not_pdf'
  | 'too_many_pages'
  | 'encrypted'
  | 'unreadable'
  | 'too_complex'
  | 'timeout'
  | 'no_text';

/** A problem with the PDF itself, with a message the student can act on. */
export class PdfReadError extends Error {
  constructor(
    readonly code: PdfErrorCode,
    message: string = PDF_ERROR_MESSAGES[code]
  ) {
    super(message);
    this.name = 'PdfReadError';
  }
}

export const PDF_ERROR_MESSAGES: Record<PdfErrorCode, string> = {
  empty: 'No file was sent.',
  too_large: `The PDF is larger than ${MAX_PDF_BYTES / (1024 * 1024)} MB.`,
  not_pdf: 'That file is not a PDF.',
  too_many_pages: `The PDF has more than ${MAX_PDF_PAGES} pages.`,
  encrypted: 'The PDF is password-protected. Remove the password and try again.',
  unreadable: 'The PDF could not be read. It may be damaged.',
  too_complex: 'The PDF is too complex to read.',
  timeout: 'The PDF took too long to read.',
  no_text:
    'The PDF has no text in it. It may be a scanned image: try a PDF where you can select the text, or paste the syllabus text instead.',
};

// --- checking the bytes ------------------------------------------------------

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

/**
 * True when "%PDF-" appears in the first 1024 bytes. The PDF format allows a
 * little junk before the signature, and readers are expected to look that far.
 */
export function looksLikePdf(bytes: Uint8Array): boolean {
  const end = Math.min(bytes.length, 1024) - PDF_SIGNATURE.length;
  for (let start = 0; start <= end; start++) {
    if (PDF_SIGNATURE.every((byte, i) => bytes[start + i] === byte)) return true;
  }
  return false;
}

// --- rebuilding lines --------------------------------------------------------

/** Font size to reason with when a PDF reports none. */
const FALLBACK_SIZE = 10;

function sizeOf(item: PdfTextItem): number {
  return item.size > 0 && Number.isFinite(item.size) ? item.size : FALLBACK_SIZE;
}

/**
 * Plain, predictable text: ligatures split ("ﬁ" to "fi"), full-width
 * characters made ordinary, invisible characters dropped, and every kind of
 * space or control character turned into one ordinary space.
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/[\s\u0000-\u001F\u007F]+/g, ' ')
    .trim();
}

/**
 * Roughly how far a run reaches above and below its baseline, as fractions of
 * its font size. Close enough for every common font.
 */
const ASCENT = 0.8;
const DESCENT = 0.2;

/**
 * Two runs are on the same line when the space they take up vertically
 * overlaps by at least half the smaller font size. That keeps a superscript
 * ("7th") or subscript on its line, while two real lines, which sit about a
 * font size apart, barely overlap at all.
 */
function onSameLine(a: PdfTextItem, b: PdfTextItem): boolean {
  const top = (item: PdfTextItem) => item.y + ASCENT * sizeOf(item);
  const bottom = (item: PdfTextItem) => item.y - DESCENT * sizeOf(item);
  const overlap = Math.min(top(a), top(b)) - Math.max(bottom(a), bottom(b));
  return overlap >= 0.5 * Math.min(sizeOf(a), sizeOf(b));
}

/**
 * Put one page's text runs back into lines, top to bottom.
 *
 * Each new run is compared with the largest run already on the current line,
 * so a small superscript cannot pull the next line up into this one. Within
 * a line, runs are read left to right, with a space wherever there is a
 * visible gap. A run drawn twice in almost the same place (how some PDFs fake
 * bold) is kept once.
 *
 * Text that shares a baseline is one line even when it is in two columns, so
 * a two-column page reads across both columns. Schedules laid out as a table
 * read as "Week 7 Midterm 1 (8 hours)", which is what we want.
 */
export function pageToLines(items: PdfTextItem[]): string[] {
  const usable = items.filter(
    (item) =>
      item.str.trim() !== '' && Number.isFinite(item.x) && Number.isFinite(item.y)
  );

  // Top of the page first. Ties go left to right so the result never depends
  // on the order pdf.js happened to report things in.
  const sorted = [...usable].sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: PdfTextItem[][] = [];
  let current: PdfTextItem[] = [];
  let largest: PdfTextItem | null = null;

  for (const item of sorted) {
    if (largest !== null && onSameLine(largest, item)) {
      current.push(item);
      if (sizeOf(item) > sizeOf(largest)) largest = item;
    } else {
      if (current.length > 0) lines.push(current);
      current = [item];
      largest = item;
    }
  }
  if (current.length > 0) lines.push(current);

  return lines.map(joinLine).filter((line) => line !== '');
}

function joinLine(items: PdfTextItem[]): string {
  const ordered = [...items].sort((a, b) => a.x - b.x || a.str.localeCompare(b.str));

  let text = '';
  let previous: PdfTextItem | null = null;
  let rightEdge = -Infinity;

  for (const item of ordered) {
    if (previous !== null) {
      const fakeBold =
        item.str === previous.str && Math.abs(item.x - previous.x) < 0.3 * sizeOf(item);
      if (fakeBold) continue;

      const gap = item.x - rightEdge;
      if (gap > 0.15 * sizeOf(item) && !text.endsWith(' ') && !item.str.startsWith(' ')) {
        text += ' ';
      }
    }
    text += item.str;
    rightEdge = Math.max(rightEdge, item.x + Math.max(0, Number.isFinite(item.width) ? item.width : 0));
    previous = item;
  }

  return normalizeText(text);
}

/** All the pages' lines as one text, and which pages had nothing on them. */
export function pagesToText(pages: PdfTextItem[][]): PdfText {
  const allLines: string[] = [];
  const pagesWithoutText: number[] = [];

  pages.forEach((items, index) => {
    const lines = pageToLines(items);
    if (lines.length === 0) pagesWithoutText.push(index + 1);
    allLines.push(...lines);
  });

  return {
    text: allLines.join('\n'),
    pageCount: pages.length,
    lineCount: allLines.length,
    pagesWithoutText,
  };
}

// --- talking to the worker ---------------------------------------------------

/** What the worker sends back when it could not read the PDF. */
export type WorkerFailure = {
  ok: false;
  name: string;
  message?: string;
  pageCount?: number;
};

/** What pdf.js throws when the file itself is the problem. */
const PDFJS_FILE_ERRORS = new Set([
  'InvalidPDFException',
  'MissingPDFException',
  'FormatError',
  'UnknownErrorException',
  'UnexpectedResponseException',
  'ResponseException',
]);

/**
 * Translate a failure from inside the worker into something the student can
 * act on. Only failures that are the file's fault become a PdfReadError.
 * Anything else (a TypeError, say) is a bug on our side and stays a plain
 * Error, so it shows up as a server error instead of blaming the student.
 */
export function errorFromWorker(
  failure: WorkerFailure,
  maxPages: number = MAX_PDF_PAGES
): PdfReadError | Error {
  if (failure.name === 'TooManyPages') {
    return new PdfReadError(
      'too_many_pages',
      `The PDF has ${failure.pageCount ?? 'too many'} pages. The most it can have is ${maxPages}.`
    );
  }
  if (failure.name === 'PasswordException') return new PdfReadError('encrypted');
  if (PDFJS_FILE_ERRORS.has(failure.name)) return new PdfReadError('unreadable');
  return new Error(`The PDF reader failed: ${failure.name}: ${failure.message ?? ''}`.trim());
}

const WORKER_FILE = path.join(__dirname, 'read-pdf.worker.mjs');

type WorkerSuccess = { ok: true; pageCount: number; pages: PdfTextItem[][] };

/**
 * Open the PDF in a worker and get every page's text runs. The worker is
 * stopped when it answers, fails, or runs out of time, so a bad PDF can never
 * leave a thread running.
 */
export function readPdfPages(bytes: Uint8Array, limits: PdfLimits = DEFAULT_LIMITS): Promise<PdfTextItem[][]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_FILE, {
      workerData: { bytes, maxPages: limits.maxPages },
      resourceLimits: { maxOldGenerationSizeMb: 256, maxYoungGenerationSizeMb: 32 },
    });

    let settled = false;
    const settle = (done: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      done();
    };

    const timer = setTimeout(
      () => settle(() => reject(new PdfReadError('timeout'))),
      limits.timeoutMs
    );

    worker.once('message', (reply: WorkerSuccess | WorkerFailure) =>
      settle(() =>
        reply.ok ? resolve(reply.pages) : reject(errorFromWorker(reply, limits.maxPages))
      )
    );

    worker.once('error', (error: Error & { code?: string }) =>
      settle(() =>
        reject(
          error.code === 'ERR_WORKER_OUT_OF_MEMORY'
            ? new PdfReadError('too_complex')
            : new Error(`The PDF reader failed: ${error.message}`)
        )
      )
    );

    worker.once('exit', (code) =>
      settle(() => reject(new Error(`The PDF reader stopped unexpectedly (exit ${code})`)))
    );
  });
}

/**
 * The text of a syllabus PDF, or a PdfReadError saying why not.
 *
 * Cheap checks first (empty, size, signature), so an obviously wrong upload
 * never starts a worker. `limits` exists so tests can use tiny ones.
 */
export async function extractPdfText(
  bytes: Uint8Array,
  limits: Partial<PdfLimits> = {}
): Promise<PdfText> {
  const resolved: PdfLimits = { ...DEFAULT_LIMITS, ...limits };

  if (bytes.length === 0) throw new PdfReadError('empty');
  if (bytes.length > resolved.maxBytes) throw new PdfReadError('too_large');
  if (!looksLikePdf(bytes)) throw new PdfReadError('not_pdf');

  const result = pagesToText(await readPdfPages(bytes, resolved));
  if (result.lineCount === 0) throw new PdfReadError('no_text');
  return result;
}
