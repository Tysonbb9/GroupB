import { extractPdfText, MAX_PDF_PAGES, PdfReadError } from '../syllabus/pdf-text';
import { asBytes, makePdf, makeScannedPdf, makeTextPdf, passwordProtectedPdf } from '../testing/pdfs';

/**
 * Real PDFs, read through the real worker and pdf.js. Nothing is mocked.
 * The PDFs are built in src/testing/pdfs.ts so each test shows what is on
 * the page.
 */

jest.setTimeout(30_000);

/** The code a rejected extraction carries, or what went wrong instead. */
async function failureCode(bytes: Uint8Array, limits = {}): Promise<string> {
  try {
    await extractPdfText(bytes, limits);
  } catch (error) {
    return error instanceof PdfReadError ? error.code : `not a PdfReadError: ${String(error)}`;
  }
  return 'it succeeded';
}

describe('reading a syllabus PDF', () => {
  it('reads one line exactly', async () => {
    const pdf = await makeTextPdf(['Week 7: Midterm 1 (8 hours)']);
    await expect(extractPdfText(pdf)).resolves.toEqual({
      text: 'Week 7: Midterm 1 (8 hours)',
      pageCount: 1,
      lineCount: 1,
      pagesWithoutText: [],
    });
  });

  it('reads every line in order, top to bottom', async () => {
    const lines = ['CS 262 Syllabus', 'Week 1: Intro', 'Week 4: Lab report (12 hours)', 'Week 9: Quiz'];
    const result = await extractPdfText(await makeTextPdf(lines));
    expect(result.text.split('\n')).toEqual(lines);
    expect(result.lineCount).toBe(4);
  });

  it('gives back lines in exactly the format the syllabus scanner reads', async () => {
    const lines = ['Week 2: Essay (4 hours)', 'Week 7 - Midterm (8 hours)', 'Week 12: Final project (20 hours)'];
    const { text } = await extractPdfText(await makeTextPdf(lines));
    for (const line of text.split('\n')) {
      expect(line).toMatch(/^Week \d+(:| -) .+ \(\d+ hours\)$/);
    }
  });

  it('joins text drawn in separate pieces on one baseline', async () => {
    const pdf = await makePdf([
      [
        { text: 'Week 7:', x: 72, y: 700 },
        { text: 'Midterm 1', x: 125, y: 700 },
        { text: '(8 hours)', x: 185, y: 700 },
      ],
    ]);
    expect((await extractPdfText(pdf)).text).toBe('Week 7: Midterm 1 (8 hours)');
  });

  it('reads a schedule table one row per line', async () => {
    const row = (y: number, week: string, date: string, due: string) => [
      { text: week, x: 72, y },
      { text: date, x: 160, y },
      { text: due, x: 260, y },
    ];
    const pdf = await makePdf([
      [
        ...row(700, 'Week', 'Date', 'Due'),
        ...row(680, 'Week 3', 'Sep 9', 'Problem set 1 (3 hours)'),
        ...row(660, 'Week 7', 'Oct 7', 'Midterm 1 (8 hours)'),
      ],
    ]);
    expect((await extractPdfText(pdf)).text.split('\n')).toEqual([
      'Week Date Due',
      'Week 3 Sep 9 Problem set 1 (3 hours)',
      'Week 7 Oct 7 Midterm 1 (8 hours)',
    ]);
  });

  it('keeps a heading and the line under it apart, whatever their sizes', async () => {
    const pdf = await makePdf([
      [
        { text: 'Schedule', y: 720, size: 22, bold: true },
        { text: 'Week 1: Intro', y: 696, size: 11 },
      ],
    ]);
    expect((await extractPdfText(pdf)).text).toBe('Schedule\nWeek 1: Intro');
  });

  it('keeps a superscript on its line', async () => {
    const pdf = await makePdf([
      [
        { text: 'Due Oct 7', x: 72, y: 700, size: 12 },
        { text: 'th', x: 124.7, y: 704, size: 7 },
      ],
    ]);
    expect((await extractPdfText(pdf)).text).toBe('Due Oct 7th');
  });

  it('keeps dashes, bullets and accents', async () => {
    const pdf = await makeTextPdf(['• Week 9 – Café quiz', 'Week 10 — Résumé (2 hours)']);
    expect((await extractPdfText(pdf)).text).toBe('• Week 9 – Café quiz\nWeek 10 — Résumé (2 hours)');
  });

  it('reads bold text', async () => {
    const pdf = await makePdf([[{ text: 'Week 5: Exam (6 hours)', y: 700, bold: true }]]);
    expect((await extractPdfText(pdf)).text).toBe('Week 5: Exam (6 hours)');
  });
});

describe('pages', () => {
  it('reads every page, in page order', async () => {
    const lines = Array.from({ length: 12 }, (_, i) => `Week ${i + 1}: Task ${i + 1}`);
    const result = await extractPdfText(await makeTextPdf(lines, 5));
    expect(result.pageCount).toBe(3);
    expect(result.text.split('\n')).toEqual(lines);
  });

  it('reports a blank page in the middle', async () => {
    const pdf = await makePdf([[{ text: 'Week 1: A', y: 700 }], [], [{ text: 'Week 3: C', y: 700 }]]);
    const result = await extractPdfText(pdf);
    expect(result.text).toBe('Week 1: A\nWeek 3: C');
    expect(result.pagesWithoutText).toEqual([2]);
  });

  it(`reads a PDF of exactly ${MAX_PDF_PAGES} pages, the limit`, async () => {
    const lines = Array.from({ length: MAX_PDF_PAGES }, (_, i) => `Page ${i + 1}`);
    const result = await extractPdfText(await makeTextPdf(lines, 1));
    expect(result.pageCount).toBe(MAX_PDF_PAGES);
    expect(result.lineCount).toBe(MAX_PDF_PAGES);
  });

  it('refuses a PDF over the page limit, saying how many pages it has', async () => {
    const pdf = await makeTextPdf(['a', 'b', 'c'], 1);
    await expect(extractPdfText(pdf, { maxPages: 2 })).rejects.toMatchObject({
      code: 'too_many_pages',
      message: 'The PDF has 3 pages. The most it can have is 2.',
    });
  });

  it('accepts a PDF at the page limit', async () => {
    const pdf = await makeTextPdf(['a', 'b'], 1);
    await expect(extractPdfText(pdf, { maxPages: 2 })).resolves.toMatchObject({ pageCount: 2 });
  });
});

describe('scanned syllabi', () => {
  it('says a PDF with no text may be scanned, and suggests pasting instead', async () => {
    const pdf = await makeScannedPdf(2);
    await expect(extractPdfText(pdf)).rejects.toMatchObject({
      code: 'no_text',
      message: expect.stringMatching(/scanned image.*paste the syllabus text/),
    });
  });

  it('reads the text of a partly scanned PDF and names the pages it could not read', async () => {
    const pdf = await makeScannedPdf(3, { page: 2, text: 'Week 4: Quiz (1 hour)' });
    await expect(extractPdfText(pdf)).resolves.toEqual({
      text: 'Week 4: Quiz (1 hour)',
      pageCount: 3,
      lineCount: 1,
      pagesWithoutText: [1, 3],
    });
  });

  it('treats a PDF of blank pages as having no text', async () => {
    expect(await failureCode(await makePdf([[], []]))).toBe('no_text');
  });
});

describe('files it cannot or should not read', () => {
  it('says a password-protected PDF is locked', async () => {
    await expect(extractPdfText(passwordProtectedPdf())).rejects.toMatchObject({
      code: 'encrypted',
      message: expect.stringMatching(/password/),
    });
  });

  it.each([
    ['a header and nothing else', () => asBytes('%PDF-1.7\n')],
    ['a header and junk', () => asBytes('%PDF-1.7\n' + 'garbage '.repeat(200))],
  ])('says a PDF with %s is damaged', async (_name, bytes) => {
    expect(await failureCode(bytes())).toBe('unreadable');
  });

  it.each([0.2, 0.5, 0.9])('says a PDF cut off at %p of its length is damaged', async (fraction) => {
    const whole = await makeTextPdf(['Week 1: A', 'Week 2: B']);
    expect(await failureCode(whole.slice(0, Math.floor(whole.length * fraction)))).toBe('unreadable');
  });

  it('says a PDF with scrambled bytes is damaged', async () => {
    const pdf = await makeTextPdf(['Week 1: A']);
    for (let i = 300; i < 600; i++) pdf[i] ^= 0xff;
    expect(await failureCode(pdf)).toBe('unreadable');
  });

  it.each([
    ['plain text', asBytes('Week 7: Midterm 1 (8 hours)')],
    ['a PNG', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])],
    ['a Word document', asBytes('PK\u0003\u0004word/document.xml')],
  ])('refuses %s as not a PDF', async (_name, bytes) => {
    expect(await failureCode(bytes)).toBe('not_pdf');
  });

  it('refuses an empty file', async () => {
    expect(await failureCode(new Uint8Array(0))).toBe('empty');
  });

  it('refuses a file over the size limit, before reading it', async () => {
    const pdf = await makeTextPdf(['Week 1: A']);
    expect(await failureCode(pdf, { maxBytes: pdf.length - 1 })).toBe('too_large');
    await expect(extractPdfText(pdf, { maxBytes: pdf.length })).resolves.toMatchObject({ lineCount: 1 });
  });

  it('gives up on a PDF that takes too long, rather than waiting forever', async () => {
    const pdf = await makeTextPdf(['Week 1: A']);
    expect(await failureCode(pdf, { timeoutMs: 1 })).toBe('timeout');
  });
});

describe('reliability', () => {
  it('accepts a Node Buffer as well as a Uint8Array, as the server receives it', async () => {
    const pdf = Buffer.from(await makeTextPdf(['Week 1: A']));
    await expect(extractPdfText(pdf)).resolves.toMatchObject({ text: 'Week 1: A' });
  });

  it('gives the same answer every time for the same PDF', async () => {
    const pdf = await makeTextPdf(['Week 1: A', 'Week 2: B (3 hours)']);
    const first = await extractPdfText(pdf);
    for (let i = 0; i < 3; i++) await expect(extractPdfText(pdf)).resolves.toEqual(first);
  });

  it('keeps several PDFs read at the same time apart', async () => {
    const pdfs = await Promise.all(
      Array.from({ length: 6 }, (_, i) => makeTextPdf([`Week ${i + 1}: Only in PDF ${i + 1}`]))
    );
    const results = await Promise.all(pdfs.map((pdf) => extractPdfText(pdf)));
    expect(results.map((r) => r.text)).toEqual(pdfs.map((_, i) => `Week ${i + 1}: Only in PDF ${i + 1}`));
  });

  it('keeps working after a bad PDF', async () => {
    expect(await failureCode(asBytes('%PDF-1.7\nnope'))).toBe('unreadable');
    await expect(extractPdfText(await makeTextPdf(['Week 1: A']))).resolves.toMatchObject({ text: 'Week 1: A' });
  });

  it('reads a long syllabus in reasonable time', async () => {
    const lines = Array.from({ length: 600 }, (_, i) => `Week ${(i % 15) + 1}: Reading ${i} (1 hour)`);
    const started = Date.now();
    const result = await extractPdfText(await makeTextPdf(lines, 40));
    expect(result.lineCount).toBe(600);
    expect(result.pageCount).toBe(15);
    expect(Date.now() - started).toBeLessThan(10_000);
  });
});
