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
  /**
   * Which way the text runs, in degrees counter-clockwise: 0 is ordinary
   * text, 90 runs up the page, -90 runs down it. Missing means 0.
   */
  angle?: number;
  /** Writing direction as pdf.js reports it. Missing means left to right. */
  dir?: 'ltr' | 'rtl' | 'ttb';
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
 * The fraction signs a syllabus might use for hours, as decimals. NFKC would
 * turn "1½" into "11⁄2" (a 1, then 1, fraction slash, 2), which reads as
 * eleven halves and which the syllabus scanner cannot read as a number.
 * Other fraction signs (⅓, ⅛, ...) have no short exact decimal, so they are
 * left to NFKC.
 */
const FRACTIONS: Record<string, string> = { '½': '5', '¼': '25', '¾': '75' };

/**
 * "1½" to "1.5", and "½" on its own to "0.5". Any digit counts, not only
 * 0 to 9: a full-width "１½" must become "１.5" (then "1.5"), not "１0.5",
 * which NFKC would turn into "10.5".
 */
function fractionsToDecimals(text: string): string {
  return text.replace(/(\p{Nd}?)([½¼¾])/gu, (_match, digit: string, sign: string) =>
    `${digit === '' ? '0' : digit}.${FRACTIONS[sign]}`
  );
}

/**
 * Plain, predictable text: fraction signs made decimals ("1½" to "1.5"),
 * ligatures split ("ﬁ" to "fi"), full-width characters made ordinary,
 * invisible characters dropped, and every kind of space or control character
 * turned into one ordinary space.
 */
export function normalizeText(text: string): string {
  return fractionsToDecimals(text)
    .normalize('NFKC')
    .replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/[\s\u0000-\u001F\u007F]+/g, ' ')
    .trim();
}

// The numbers that decide how lines are rebuilt. Each is a fraction of the
// font size, so they work the same for 8pt footnotes and 24pt headings.

/**
 * How far a run reaches above and below its baseline. A font's letters sit
 * in a box one font size tall (the "em"), and this splits it 0.8 above the
 * baseline and 0.2 below. Real fonts are close: Helvetica's capitals rise
 * 0.718 and its descenders drop 0.207; Times is 0.683 and 0.217. Using the
 * whole em box leaves room for accents above capitals.
 */
const ASCENT = 0.8;
const DESCENT = 0.2;

/**
 * Two runs share a line when their boxes overlap vertically by at least this
 * much of the smaller font size. Lines of text sit about 1.2 font sizes
 * apart, so their boxes overlap by 0 or less. A superscript or subscript is
 * raised or lowered by about a third of a font size, so it still overlaps
 * its line by well over half.
 */
const SAME_LINE_OVERLAP = 0.5;

/**
 * The same text drawn again within this distance is one run drawn twice,
 * which is how some PDFs fake bold (the second copy is shifted a fraction of
 * a point). 0.3 of the font size is 3.6pt at 12pt: wider than any such
 * shift, but narrower than one letter, so a word that really appears twice
 * in a row is kept.
 */
const FAKE_BOLD_DISTANCE = 0.3;

/**
 * A gap wider than this between runs is a space. 0.15 of the font size is
 * 1.8pt at 12pt: wider than the kerning between letters (well under 1pt),
 * narrower than a space in any common font (about 0.25 of the font size).
 */
const WORD_GAP = 0.15;

/**
 * Two runs are on the same line when the space they take up vertically
 * overlaps enough (see SAME_LINE_OVERLAP). That keeps a superscript ("7th")
 * or subscript on its line, while two real lines barely overlap at all.
 */
function onSameLine(a: PdfTextItem, b: PdfTextItem): boolean {
  const top = (item: PdfTextItem) => item.y + ASCENT * sizeOf(item);
  const bottom = (item: PdfTextItem) => item.y - DESCENT * sizeOf(item);
  const overlap = Math.min(top(a), top(b)) - Math.max(bottom(a), bottom(b));
  return overlap >= SAME_LINE_OVERLAP * Math.min(sizeOf(a), sizeOf(b));
}

/** The run's angle in whole degrees from -179 to 180, or 0 when unusable. */
function angleOf(item: PdfTextItem): number {
  const angle = item.angle;
  if (angle === undefined || !Number.isFinite(angle)) return 0;
  const whole = Math.round(angle) % 360;
  if (whole > 180) return whole - 360;
  if (whole <= -180) return whole + 360;
  return whole === 0 ? 0 : whole; // never -0
}

/**
 * The run as if the page were turned so that its text ran left to right:
 * x becomes the distance along the text, and y the distance across it.
 * Sideways text then goes through the same line rules as ordinary text.
 */
function turnUpright(item: PdfTextItem, angle: number): PdfTextItem {
  if (angle === 0) return item;
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    ...item,
    x: item.x * cos + item.y * sin,
    y: -item.x * sin + item.y * cos,
  };
}

/**
 * Put one page's text runs back into lines, in reading order.
 *
 * Ordinary text comes first, top to bottom. Text turned sideways (a rotated
 * table heading, a label up the margin) is grouped by its angle and read
 * after it, one group at a time from the smallest angle to the largest, each
 * as if the page were turned to read it.
 *
 * Each new run is compared with the largest run already on the current line,
 * so a small superscript cannot pull the next line up into this one. Within
 * a line, runs are read in the line's writing direction, with a space
 * wherever there is a visible gap. A run drawn twice in almost the same
 * place (how some PDFs fake bold) is kept once.
 *
 * Known limits, each pinned by a test:
 *  - Text that shares a baseline is one line even when it is in two columns,
 *    so a two-column page reads across both columns. Schedules laid out as a
 *    table read as "Week 7 Midterm 1 (8 hours)", which is what we want.
 *  - Two columns whose baselines are offset are read line by line in turn,
 *    left, right, left, right, because each line is placed by its height
 *    alone. Telling columns apart would need a layout analysis we do not do.
 */
export function pageToLines(items: PdfTextItem[]): string[] {
  const usable = items.filter(
    (item) =>
      item.str.trim() !== '' && Number.isFinite(item.x) && Number.isFinite(item.y)
  );

  const byAngle = new Map<number, PdfTextItem[]>();
  for (const item of usable) {
    const angle = angleOf(item);
    byAngle.set(angle, [...(byAngle.get(angle) ?? []), turnUpright(item, angle)]);
  }

  // Upright text first, then each angle in turn, so the order never depends
  // on the order pdf.js reported things in.
  const angles = [...byAngle.keys()].sort((a, b) => (a === 0 ? -1 : b === 0 ? 1 : a - b));
  return angles.flatMap((angle) => uprightLines(byAngle.get(angle)!));
}

/** The lines of runs that all read left to right or right to left, top to bottom. */
function uprightLines(usable: PdfTextItem[]): string[] {
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

function widthOf(item: PdfTextItem): number {
  return Math.max(0, Number.isFinite(item.width) ? item.width : 0);
}

/**
 * A line is right to left (Hebrew, Arabic) when more of its runs say so than
 * say left to right. A single Hebrew word in an English line stays where it
 * is, and so does an English word in a Hebrew line.
 */
function isRightToLeft(items: PdfTextItem[]): boolean {
  const rtl = items.filter((item) => item.dir === 'rtl').length;
  const ltr = items.filter((item) => item.dir !== 'rtl').length;
  return rtl > ltr;
}

/**
 * The run seen in a mirror, so that a right-to-left line can be read with
 * the same left-to-right rules: its right edge becomes its left edge.
 */
function mirror(item: PdfTextItem): PdfTextItem {
  return { ...item, x: -(item.x + widthOf(item)) };
}

function joinLine(items: PdfTextItem[]): string {
  const facing = isRightToLeft(items) ? items.map(mirror) : items;
  const ordered = [...facing].sort((a, b) => a.x - b.x || a.str.localeCompare(b.str));

  let text = '';
  let previous: PdfTextItem | null = null;
  let rightEdge = -Infinity;

  for (const item of ordered) {
    if (previous !== null) {
      const fakeBold =
        item.str === previous.str && Math.abs(item.x - previous.x) < FAKE_BOLD_DISTANCE * sizeOf(item);
      if (fakeBold) continue;

      const gap = item.x - rightEdge;
      if (gap > WORD_GAP * sizeOf(item) && !text.endsWith(' ') && !item.str.startsWith(' ')) {
        text += ' ';
      }
    }
    text += item.str;
    rightEdge = Math.max(rightEdge, item.x + widthOf(item));
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
