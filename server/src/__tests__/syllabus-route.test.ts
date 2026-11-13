import request from 'supertest';
import { app } from '../app';
import { resetDb } from '../data/db';
import * as pdfText from '../syllabus/pdf-text';
import { MAX_PDF_BYTES, PDF_ERROR_MESSAGES, PdfErrorCode, PdfReadError } from '../syllabus/pdf-text';
import { MAX_CONCURRENT_PDF_READS } from '../syllabus/routes';
import { makeScannedPdf, makeTextPdf, passwordProtectedPdf } from '../testing/pdfs';

/** POST /syllabus/text over HTTP, through the real app, worker and pdf.js. */

jest.setTimeout(30_000);

beforeEach(() => resetDb());
afterEach(() => jest.restoreAllMocks());

const postPdf = (bytes: Uint8Array | Buffer, type = 'application/pdf') =>
  request(app).post('/syllabus/text').set('Content-Type', type).send(Buffer.from(bytes));

describe('POST /syllabus/text', () => {
  it('answers with the text of the PDF', async () => {
    const res = await postPdf(await makeTextPdf(['Week 4: Lab report (12 hours)', 'Week 9: Quiz']));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toEqual({
      text: 'Week 4: Lab report (12 hours)\nWeek 9: Quiz',
      pageCount: 1,
      lineCount: 2,
      pagesWithoutText: [],
    });
  });

  it('accepts a content type with parameters', async () => {
    const res = await postPdf(await makeTextPdf(['Week 1: A']), 'application/pdf; charset=binary');
    expect(res.status).toBe(200);
  });

  it('refuses JSON with 415', async () => {
    const res = await request(app).post('/syllabus/text').send({ text: 'Week 1: A' });
    expect(res.status).toBe(415);
    expect(res.body).toEqual({ error: PDF_ERROR_MESSAGES.not_pdf, code: 'not_pdf' });
  });

  it('refuses a request with no content type with 415', async () => {
    const res = await request(app).post('/syllabus/text');
    expect(res.status).toBe(415);
  });

  it('refuses a file that is not really a PDF with 415', async () => {
    const res = await postPdf(Buffer.from('Week 7: Midterm 1 (8 hours)'));
    expect(res.status).toBe(415);
    expect(res.body).toEqual({ error: 'That file is not a PDF.', code: 'not_pdf' });
  });

  it('refuses an empty body with 400', async () => {
    const res = await postPdf(Buffer.alloc(0));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'No file was sent.', code: 'empty' });
  });

  it('refuses a file over 10 MB with 413, in the same JSON shape', async () => {
    const res = await postPdf(Buffer.alloc(MAX_PDF_BYTES + 1, 0x20));
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'The PDF is larger than 10 MB.', code: 'too_large' });
  });

  it('explains a scanned PDF with 422', async () => {
    const res = await postPdf(await makeScannedPdf());
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('no_text');
    expect(res.body.error).toMatch(/paste the syllabus text/);
  });

  it('explains a password-protected PDF with 422', async () => {
    const res = await postPdf(passwordProtectedPdf());
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('encrypted');
  });

  it('explains a damaged PDF with 422', async () => {
    const res = await postPdf(Buffer.from('%PDF-1.7\n' + 'garbage '.repeat(100)));
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: 'The PDF could not be read. It may be damaged.', code: 'unreadable' });
  });

  it('answers 500 without blaming the student when something unexpected breaks', async () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    const cause = new TypeError('x is not a function');
    jest.spyOn(pdfText, 'extractPdfText').mockRejectedValue(cause);
    const res = await postPdf(await makeTextPdf(['Week 1: A']));
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: 'Something went wrong reading the PDF. Try again, or paste the syllabus text instead.',
      code: 'server_error',
    });
    expect(logged).toHaveBeenCalledWith('Syllabus PDF read failed:', cause);
  });

  it('accepts a file of exactly 10 MB past the size check, then refuses it as not a PDF', async () => {
    const res = await postPdf(Buffer.alloc(MAX_PDF_BYTES, 0x20));
    expect(res.status).toBe(415);
    expect(res.body.code).toBe('not_pdf');
  });

  describe('where the %PDF- signature may start', () => {
    const withSignatureAt = (offset: number) => {
      const bytes = Buffer.alloc(1200, 0x20);
      bytes.write('%PDF-', offset, 'latin1');
      return bytes;
    };

    it('accepts it at byte 1019, the last place readers look', async () => {
      const res = await postPdf(withSignatureAt(1019));
      expect(res.status).not.toBe(415); // past the signature check; the junk after it is then unreadable
    });

    it('refuses it at byte 1020 with 415', async () => {
      const res = await postPdf(withSignatureAt(1020));
      expect(res.status).toBe(415);
      expect(res.body.code).toBe('not_pdf');
    });
  });

  describe('every way reading a PDF can fail', () => {
    const expected: Record<PdfErrorCode, number> = {
      empty: 400,
      too_large: 413,
      not_pdf: 415,
      too_many_pages: 422,
      encrypted: 422,
      unreadable: 422,
      too_complex: 422,
      timeout: 503,
      no_text: 422,
    };

    it.each(Object.entries(expected))('answers %s with %i and the shared JSON shape', async (code, status) => {
      jest.spyOn(pdfText, 'extractPdfText').mockRejectedValue(new PdfReadError(code as PdfErrorCode));
      const res = await postPdf(await makeTextPdf(['Week 1: A']));
      expect(res.status).toBe(status);
      expect(res.body).toEqual({ error: PDF_ERROR_MESSAGES[code as PdfErrorCode], code });
    });
  });

  describe('errors while reading the request body', () => {
    it('answers an unsupported Content-Encoding in JSON, not an HTML page', async () => {
      const res = await postPdf(await makeTextPdf(['Week 1: A'])).set('Content-Encoding', 'nonsense');
      expect(res.status).toBe(415);
      expect(res.headers['content-type']).toMatch(/json/);
      expect(res.body.code).toBe('bad_upload');
      expect(typeof res.body.error).toBe('string');
    });
  });

  describe('limiting PDFs read at once', () => {
    it('answers 503 when the server is already reading its limit, then recovers', async () => {
      const releases: Array<() => void> = [];
      const result = { text: 'Week 1: A', pageCount: 1, lineCount: 1, pagesWithoutText: [] };
      const extract = jest.spyOn(pdfText, 'extractPdfText').mockImplementation(
        () => new Promise((resolve) => releases.push(() => resolve(result)))
      );
      const bytes = await makeTextPdf(['Week 1: A']);

      const busy = Array.from({ length: MAX_CONCURRENT_PDF_READS }, () => postPdf(bytes).then((res) => res));
      while (extract.mock.calls.length < MAX_CONCURRENT_PDF_READS) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const refused = await postPdf(bytes);
      expect(refused.status).toBe(503);
      expect(refused.body.code).toBe('busy');
      expect(refused.body.error).toMatch(/try again/i);

      releases.forEach((release) => release());
      for (const res of await Promise.all(busy)) expect(res.status).toBe(200);

      extract.mockResolvedValue(result);
      expect((await postPdf(bytes)).status).toBe(200); // the slots were given back
    });

    it('gives its slot back when a read fails, so failures cannot fill the cap', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(pdfText, 'extractPdfText').mockRejectedValue(new Error('boom'));
      const bytes = await makeTextPdf(['Week 1: A']);
      for (let i = 0; i < MAX_CONCURRENT_PDF_READS + 2; i++) {
        expect((await postPdf(bytes)).status).toBe(500); // never 503
      }
    });
  });

  it('does not exist for GET', async () => {
    expect((await request(app).get('/syllabus/text')).status).toBe(404);
  });
});

describe('CORS for the PDF upload', () => {
  it('answers the preflight a browser sends before posting a PDF', async () => {
    const res = await request(app)
      .options('/syllabus/text')
      .set('Origin', 'http://localhost:8081')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-methods']).toContain('POST');
    expect(res.headers['access-control-allow-headers']).toMatch(/content-type/i);
  });

  it('lets a web page read the answer', async () => {
    const res = await postPdf(await makeTextPdf(['Week 1: A'])).set('Origin', 'http://localhost:8081');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});

describe('the rest of the server is unaffected', () => {
  it('still reads JSON for PATCH /tasks', async () => {
    const res = await request(app).patch('/tasks/262-2').send({ done: true });
    expect(res.status).toBe(200);
    expect(res.body.done).toBe(true);
  });

  it('does not answer an oversized JSON request with the PDF message', async () => {
    const res = await request(app)
      .patch('/tasks/262-2')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ done: true, padding: 'x'.repeat(200_000) }));
    expect(res.status).toBe(413);
    expect(res.text).not.toMatch(/PDF/);
  });
});
