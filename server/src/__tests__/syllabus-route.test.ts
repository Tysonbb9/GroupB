import request from 'supertest';
import { app } from '../app';
import { resetDb } from '../data/db';
import * as pdfText from '../syllabus/pdf-text';
import { MAX_PDF_BYTES } from '../syllabus/pdf-text';
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
    expect(res.body).toEqual({ error: 'Send the PDF with Content-Type: application/pdf.', code: 'not_pdf' });
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
    jest.spyOn(pdfText, 'extractPdfText').mockRejectedValue(new TypeError('x is not a function'));
    const res = await postPdf(await makeTextPdf(['Week 1: A']));
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Something went wrong reading the PDF.' });
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
