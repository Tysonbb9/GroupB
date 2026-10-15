import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';

/**
 * Real PDFs for the tests, built in code so every test shows exactly what is
 * on the page. Lives outside src/__tests__ so Jest does not run it as a test.
 */

/** One piece of text to draw. y is measured from the bottom of the page. */
export type Run = {
  text: string;
  x?: number;
  y: number;
  size?: number;
  bold?: boolean;
};

const LETTER: [number, number] = [612, 792];

/** A PDF with these runs on each page. An empty array is a blank page. */
export async function makePdf(pages: Run[][]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const runs of pages) {
    const page = doc.addPage(LETTER);
    for (const run of runs) {
      page.drawText(run.text, {
        x: run.x ?? 72,
        y: run.y,
        size: run.size ?? 12,
        font: run.bold ? bold : regular,
      });
    }
  }
  return doc.save();
}

/** Lines of text written down the page from the top, onto as many pages as needed. */
export async function makeTextPdf(lines: string[], linesPerPage = 40): Promise<Uint8Array> {
  const pages: Run[][] = [];
  for (let start = 0; start < lines.length; start += linesPerPage) {
    pages.push(
      lines.slice(start, start + linesPerPage).map((text, i) => ({ text, y: 740 - i * 16, size: 11 }))
    );
  }
  return makePdf(pages.length > 0 ? pages : [[]]);
}

/** A 1 by 1 pixel PNG, stretched over a page to stand in for a scanned image. */
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64'
);

/**
 * Pages that are only an image, like a scanned syllabus. `textOnPage` adds
 * one line of real text to that page (numbered from 1), for a PDF that is
 * only partly scanned.
 */
export async function makeScannedPdf(pageCount = 1, textOnPage?: { page: number; text: string }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const image = await doc.embedPng(PIXEL_PNG);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (let n = 1; n <= pageCount; n++) {
    const page = doc.addPage(LETTER);
    page.drawImage(image, { x: 0, y: 0, width: LETTER[0], height: LETTER[1] });
    if (textOnPage?.page === n) page.drawText(textOnPage.text, { x: 72, y: 700, size: 12, font });
  }
  return doc.save();
}

/**
 * A one-page PDF locked with a password (AES-256), made once with qpdf and
 * kept as a file, since pdf-lib cannot encrypt. Its text is
 * "Week 3: Locked quiz (2 hours)"; the password is "crunchweek".
 */
export function passwordProtectedPdf(): Uint8Array {
  return new Uint8Array(readFileSync(path.join(__dirname, 'fixtures', 'password-protected.pdf')));
}

export const asBytes = (text: string): Uint8Array => new TextEncoder().encode(text);
