import {
  errorFromWorker,
  looksLikePdf,
  normalizeText,
  PDF_ERROR_MESSAGES,
  pagesToText,
  pageToLines,
  PdfReadError,
  PdfTextItem,
} from '../syllabus/pdf-text';
import { asBytes } from '../testing/pdfs';

/**
 * The pure half of the PDF reader: no PDFs and no worker, just the rules for
 * turning positioned text back into lines. Real PDFs are in pdf-extract.test.ts.
 */

/** A run of text. Width defaults to half the font size per character, roughly Helvetica. */
function run(str: string, x: number, y: number, size = 12, width = str.length * size * 0.5): PdfTextItem {
  return { str, x, y, width, size };
}

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// --- looksLikePdf -------------------------------------------------------------

describe('looksLikePdf', () => {
  it('recognises the PDF signature at the start', () => {
    expect(looksLikePdf(asBytes('%PDF-1.7\n...'))).toBe(true);
  });

  it('allows a little junk before the signature, as the format does', () => {
    expect(looksLikePdf(asBytes('\uFEFF\r\n  %PDF-1.4'))).toBe(true);
  });

  it('looks no further than the first 1024 bytes', () => {
    const at = (start: number) => {
      const bytes = new Uint8Array(start + 5).fill(0x20);
      bytes.set(asBytes('%PDF-'), start);
      return bytes;
    };
    expect(looksLikePdf(at(1019))).toBe(true); // ends on byte 1023
    expect(looksLikePdf(at(1020))).toBe(false); // would need byte 1024
  });

  it.each([
    ['empty', ''],
    ['too short', '%PDF'],
    ['plain text', 'Week 7: Midterm 1 (8 hours)'],
    ['a ZIP or Word file', 'PK\u0003\u0004'],
    ['almost a PDF', '%PDX-1.7'],
    ['lower case', '%pdf-1.7'],
  ])('rejects %s', (_name, text) => {
    expect(looksLikePdf(asBytes(text))).toBe(false);
  });

  it('rejects a PNG', () => {
    expect(looksLikePdf(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(false);
  });
});

// --- normalizeText ------------------------------------------------------------

describe('normalizeText', () => {
  it('splits ligatures back into letters', () => {
    expect(normalizeText('ﬁnal ﬂoor eﬀort')).toBe('final floor effort');
  });

  it('turns full-width characters into ordinary ones, so hours can be read', () => {
    expect(normalizeText('Week ７：Quiz （８ hours）')).toBe('Week 7:Quiz (8 hours)');
  });

  it('turns every kind of space into one ordinary space', () => {
    expect(normalizeText('Week\u00A07\u2009:\tQuiz\u3000now')).toBe('Week 7 : Quiz now');
  });

  it('drops invisible characters', () => {
    expect(normalizeText('Mid\u00ADterm\u200B \uFEFFexam\u2060')).toBe('Midterm exam');
  });

  it('turns control characters into spaces', () => {
    expect(normalizeText('Week\u00007\u0001:\u007FQuiz')).toBe('Week 7 : Quiz');
  });

  it('collapses and trims spaces', () => {
    expect(normalizeText('   Week   7:    Quiz   ')).toBe('Week 7: Quiz');
  });

  it('keeps dashes, bullets and accents', () => {
    expect(normalizeText('• Week 9 – Café — quiz')).toBe('• Week 9 – Café — quiz');
  });

  it('returns nothing for nothing', () => {
    expect(normalizeText('')).toBe('');
    expect(normalizeText(' \u00A0\u200B ')).toBe('');
  });
});

// --- pageToLines ----------------------------------------------------------------

describe('pageToLines', () => {
  it('reads a single run as a single line', () => {
    expect(pageToLines([run('Week 7: Midterm 1 (8 hours)', 72, 700)])).toEqual(['Week 7: Midterm 1 (8 hours)']);
  });

  it('reads top to bottom, whatever order the runs arrive in', () => {
    const lines = pageToLines([run('third', 72, 660), run('first', 72, 700), run('second', 72, 680)]);
    expect(lines).toEqual(['first', 'second', 'third']);
  });

  it('reads left to right within a line, whatever order the runs arrive in', () => {
    const lines = pageToLines([run('(8 hours)', 200, 700), run('Week 7:', 72, 700), run('Midterm 1', 130, 700)]);
    expect(lines).toEqual(['Week 7: Midterm 1 (8 hours)']);
  });

  it('puts a space where there is a visible gap', () => {
    expect(pageToLines([run('Week', 72, 700, 12, 30), run('7', 105, 700, 12, 6)])).toEqual(['Week 7']);
  });

  it('adds no space when runs touch, as when one word is split in two', () => {
    expect(pageToLines([run('Mid', 72, 700, 12, 20), run('term', 92, 700, 12, 24)])).toEqual(['Midterm']);
  });

  it('adds no space for a gap too small to see', () => {
    // 0.15 of a 12pt font is 1.8pt; 1pt is kerning, not a space.
    expect(pageToLines([run('Mid', 72, 700, 12, 20), run('term', 93, 700, 12, 24)])).toEqual(['Midterm']);
  });

  it('adds no space when runs overlap', () => {
    expect(pageToLines([run('Mid', 72, 700, 12, 20), run('term', 90, 700, 12, 24)])).toEqual(['Midterm']);
  });

  it('never doubles a space that is already there', () => {
    expect(pageToLines([run('Week ', 72, 700, 12, 30), run(' 7', 110, 700, 12, 8)])).toEqual(['Week 7']);
  });

  it('keeps a superscript on its line', () => {
    expect(pageToLines([run('Due Oct 7', 72, 700, 12, 54), run('th', 127, 704, 7, 6)])).toEqual(['Due Oct 7th']);
  });

  it('keeps a superscript and a subscript on the same line', () => {
    // Sorted top down, the raised "2" comes first. The lowered "2" barely
    // touches it, so it only stays on the line because it is measured against
    // the full-size text, not against the superscript.
    const items = [run('x', 72, 700, 12, 6), run('2', 79, 704, 7, 3.5), run('+ y', 86, 700, 12, 16), run('2', 103, 697, 7, 3.5)];
    expect(pageToLines(items)).toEqual(['x2 + y2']);
  });

  it('keeps runs within half a font size on one line, and splits beyond that', () => {
    expect(pageToLines([run('a', 72, 700), run('b', 90, 694)])).toEqual(['a b']); // exactly 6pt apart
    expect(pageToLines([run('a', 72, 700), run('b', 90, 693.9)])).toEqual(['a', 'b']);
  });

  it('uses the smaller font when sizes differ, so a small line under a heading stays separate', () => {
    expect(pageToLines([run('Schedule', 72, 700, 24), run('Week 1', 72, 692, 10)])).toEqual(['Schedule', 'Week 1']);
  });

  it('keeps text drawn twice in the same place (fake bold) only once', () => {
    expect(pageToLines([run('Week 7', 72, 700), run('Week 7', 72.4, 700.2), run('Quiz', 120, 700)])).toEqual([
      'Week 7 Quiz',
    ]);
  });

  it('keeps the same word twice when it really appears twice', () => {
    expect(pageToLines([run('Quiz', 72, 700, 12, 24), run('Quiz', 200, 700, 12, 24)])).toEqual(['Quiz Quiz']);
  });

  it('reads a schedule table row as one line, in the scanner format', () => {
    const row = [run('Week 7', 72, 500), run('Oct 14', 160, 500), run('Midterm 1 (8 hours)', 240, 500)];
    expect(pageToLines(row)).toEqual(['Week 7 Oct 14 Midterm 1 (8 hours)']);
  });

  it('joins two columns that share a baseline (a known limit)', () => {
    expect(pageToLines([run('Week 3: Quiz', 72, 700), run('Office hours', 330, 700)])).toEqual([
      'Week 3: Quiz Office hours',
    ]);
  });

  it('ignores runs that are only whitespace', () => {
    expect(pageToLines([run('  ', 72, 720), run('Quiz', 72, 700), run('\u00A0', 72, 680)])).toEqual(['Quiz']);
  });

  it('ignores runs with no usable position', () => {
    expect(pageToLines([run('lost', NaN, 700), run('gone', 72, Infinity), run('Quiz', 72, 700)])).toEqual(['Quiz']);
  });

  it('copes with a run that reports no size or no width', () => {
    expect(pageToLines([run('Week', 72, 700, 0, 30), run('7', 110, 700, NaN, NaN)])).toEqual(['Week 7']);
  });

  it('drops a line that is empty once tidied', () => {
    expect(pageToLines([run('\u200B', 72, 700), run('Quiz', 72, 680)])).toEqual(['Quiz']);
  });

  it('gives nothing for an empty page', () => {
    expect(pageToLines([])).toEqual([]);
  });

  it('tidies each line it builds', () => {
    expect(pageToLines([run('ﬁnal  ', 72, 700, 12, 30), run('\u00ADexam', 110, 700)])).toEqual(['final exam']);
  });
});

// --- pagesToText ----------------------------------------------------------------

describe('pagesToText', () => {
  it('joins the lines of every page, in page order', () => {
    const result = pagesToText([[run('Week 1: A', 72, 700)], [run('Week 2: B', 72, 700), run('Week 3: C', 72, 680)]]);
    expect(result).toEqual({
      text: 'Week 1: A\nWeek 2: B\nWeek 3: C',
      pageCount: 2,
      lineCount: 3,
      pagesWithoutText: [],
    });
  });

  it('numbers the pages with no text from 1', () => {
    const result = pagesToText([[], [run('Quiz', 72, 700)], [run(' ', 72, 700)]]);
    expect(result.pagesWithoutText).toEqual([1, 3]);
    expect(result.lineCount).toBe(1);
  });

  it('reports a document with no text at all', () => {
    expect(pagesToText([[], []])).toEqual({ text: '', pageCount: 2, lineCount: 0, pagesWithoutText: [1, 2] });
  });

  it('handles no pages', () => {
    expect(pagesToText([])).toEqual({ text: '', pageCount: 0, lineCount: 0, pagesWithoutText: [] });
  });
});

// --- errorFromWorker --------------------------------------------------------------

describe('errorFromWorker', () => {
  it('names the page count and the limit when a PDF is too long', () => {
    const error = errorFromWorker({ ok: false, name: 'TooManyPages', pageCount: 73 }, 50);
    expect(error).toBeInstanceOf(PdfReadError);
    expect((error as PdfReadError).code).toBe('too_many_pages');
    expect(error.message).toBe('The PDF has 73 pages. The most it can have is 50.');
  });

  it('says a locked PDF is locked', () => {
    const error = errorFromWorker({ ok: false, name: 'PasswordException', message: 'No password given' });
    expect((error as PdfReadError).code).toBe('encrypted');
    expect(error.message).toMatch(/password/i);
  });

  it.each([
    'InvalidPDFException',
    'MissingPDFException',
    'FormatError',
    'UnknownErrorException',
    'UnexpectedResponseException',
    'ResponseException',
  ])('treats pdf.js %s as a damaged file', (name) => {
    const error = errorFromWorker({ ok: false, name, message: 'whatever' });
    expect(error).toBeInstanceOf(PdfReadError);
    expect((error as PdfReadError).code).toBe('unreadable');
  });

  it.each(['TypeError', 'ReferenceError', 'RangeError', 'Error'])(
    'does not blame the file for %s, which is a bug on our side',
    (name) => {
      const error = errorFromWorker({ ok: false, name, message: 'x is not a function' });
      expect(error).not.toBeInstanceOf(PdfReadError);
      expect(error.message).toBe(`The PDF reader failed: ${name}: x is not a function`);
    }
  );
});

describe('PdfReadError', () => {
  it('carries a code and a message the student can act on', () => {
    const error = new PdfReadError('no_text');
    expect(error.code).toBe('no_text');
    expect(error.name).toBe('PdfReadError');
    expect(error.message).toBe(PDF_ERROR_MESSAGES.no_text);
    expect(error.message).toMatch(/scanned/);
    expect(error.message).toMatch(/paste/);
  });

  it('has a message for every code', () => {
    for (const message of Object.values(PDF_ERROR_MESSAGES)) {
      expect(message.length).toBeGreaterThan(10);
      expect(message.endsWith('.')).toBe(true);
    }
  });
});

// --- randomised checks ------------------------------------------------------------

describe('randomised checks (seeded, so any failure can be replayed)', () => {
  const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);

  /** Random words at random places on a page, every word different. */
  function randomPage(random: () => number): PdfTextItem[] {
    const count = 1 + Math.floor(random() * 40);
    return Array.from({ length: count }, (_, i) => {
      const size = 6 + random() * 18;
      const word = `w${i}${'abcdefghij'.slice(0, 1 + Math.floor(random() * 9))}`;
      return run(word, random() * 500, random() * 750, size, word.length * size * (0.3 + random() * 0.5));
    });
  }

  const letters = (lines: string[]) => lines.join('').replace(/ /g, '').split('').sort().join('');

  it.each(SEEDS)('loses and invents no text, only rearranges it (seed %i)', (seed) => {
    const random = seeded(seed);
    const items = randomPage(random);
    const lines = pageToLines(items);
    expect(letters(lines)).toBe(letters(items.map((i) => i.str)));
  });

  it.each(SEEDS)('gives the same lines whatever order the runs arrive in (seed %i)', (seed) => {
    const random = seeded(seed * 31);
    const items = randomPage(random);
    const expected = pageToLines(items);
    for (let round = 0; round < 5; round++) {
      expect(pageToLines(shuffle(items, random))).toEqual(expected);
    }
  });

  it.each(SEEDS)('always produces tidy lines (seed %i)', (seed) => {
    const random = seeded(seed * 977);
    for (const line of pageToLines(randomPage(random))) {
      expect(line).toBe(line.trim());
      expect(line).not.toBe('');
      expect(line).not.toMatch(/\n| {2}/);
    }
  });

  it.each(SEEDS)('never throws on hostile runs (seed %i)', (seed) => {
    const random = seeded(seed * 7919);
    const weird = [NaN, Infinity, -Infinity, 0, -5, 1e308, -1e308, 0.0001];
    const strings = ['', ' ', '\u0000', '\u200B', 'ﬁ', '漢字', '😀', 'Week 7', '\uD800', '\n'];
    const items: PdfTextItem[] = Array.from({ length: 60 }, () => ({
      str: strings[Math.floor(random() * strings.length)],
      x: random() < 0.3 ? weird[Math.floor(random() * weird.length)] : random() * 600,
      y: random() < 0.3 ? weird[Math.floor(random() * weird.length)] : random() * 800,
      width: random() < 0.3 ? weird[Math.floor(random() * weird.length)] : random() * 100,
      size: random() < 0.3 ? weird[Math.floor(random() * weird.length)] : random() * 20,
    }));
    expect(() => pagesToText([items, items.slice(0, 10), []])).not.toThrow();
  });
});
