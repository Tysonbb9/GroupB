import { extractSyllabusText } from './api';

/**
 * extractSyllabusText: sending a syllabus PDF to POST /syllabus/text.
 * fetch is replaced here so no server is needed; the server's side is tested
 * against real PDFs in server/src/__tests__/.
 */

/** The parts of a fetch Response that extractSyllabusText reads. */
const reply = (body: unknown, status = 200) =>
  ({
    ok: status < 400,
    status,
    json: async () => {
      if (body instanceof Error) throw body;
      return body;
    },
  }) as Response;

const fetchMock = jest.fn();
const realFetch = globalThis.fetch;

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

const goodReply = {
  text: 'Week 4: Lab report (12 hours)\nWeek 9: Quiz',
  pageCount: 2,
  lineCount: 2,
  pagesWithoutText: [2],
};

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]); // "%PDF-1.7"

describe('extractSyllabusText', () => {
  it('returns the text the server read', async () => {
    fetchMock.mockResolvedValue(reply(goodReply));
    await expect(extractSyllabusText(pdfBytes)).resolves.toEqual(goodReply);
  });

  it('posts the PDF to /syllabus/text as application/pdf', async () => {
    fetchMock.mockResolvedValue(reply(goodReply));
    await extractSyllabusText(pdfBytes);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/syllabus\/text$/);
    expect(init).toMatchObject({ method: 'POST', headers: { 'Content-Type': 'application/pdf' } });
    expect(init.body).toBe(pdfBytes);
  });

  it.each([
    ['a Uint8Array', pdfBytes],
    ['an ArrayBuffer', pdfBytes.buffer],
    ['a Blob', new Blob([pdfBytes], { type: 'application/pdf' })],
  ])('sends %s as it is', async (_name, body) => {
    fetchMock.mockResolvedValue(reply(goodReply));
    await extractSyllabusText(body);
    expect(fetchMock.mock.calls[0][1].body).toBe(body);
  });

  it("passes on the server's explanation when the PDF is the problem", async () => {
    const message =
      'The PDF has no text in it. It may be a scanned image: try a PDF where you can select the text, or paste the syllabus text instead.';
    fetchMock.mockResolvedValue(reply({ error: message, code: 'no_text' }, 422));
    await expect(extractSyllabusText(pdfBytes)).rejects.toThrow(message);
  });

  it.each([
    ['locked', 422, 'The PDF is password-protected. Remove the password and try again.'],
    ['too big', 413, 'The PDF is larger than 10 MB.'],
    ['not a PDF', 415, 'That file is not a PDF.'],
  ])('passes on the message for a PDF that is %s', async (_name, status, message) => {
    fetchMock.mockResolvedValue(reply({ error: message }, status));
    await expect(extractSyllabusText(pdfBytes)).rejects.toThrow(message);
  });

  it('falls back to the status when the error body is not JSON', async () => {
    fetchMock.mockResolvedValue(reply(new SyntaxError('Unexpected token <'), 502));
    await expect(extractSyllabusText(pdfBytes)).rejects.toThrow('The server answered 502');
  });

  it.each([[{}], [{ error: '' }], [{ error: 42 }], [null], ['oops']])(
    'falls back to the status when the error body has no usable message: %j',
    async (body) => {
      fetchMock.mockResolvedValue(reply(body, 500));
      await expect(extractSyllabusText(pdfBytes)).rejects.toThrow('The server answered 500');
    }
  );

  it.each([
    ['nothing', null],
    ['no text', { ...goodReply, text: undefined }],
    ['text that is not a string', { ...goodReply, text: 42 }],
    ['no page count', { ...goodReply, pageCount: '2' }],
    ['no line count', { ...goodReply, lineCount: undefined }],
    ['pages that are not a list', { ...goodReply, pagesWithoutText: 2 }],
    ['pages that are not numbers', { ...goodReply, pagesWithoutText: ['2'] }],
  ])('rejects a reply with %s', async (_name, body) => {
    fetchMock.mockResolvedValue(reply(body));
    await expect(extractSyllabusText(pdfBytes)).rejects.toThrow('The server sent invalid syllabus text');
  });

  it('accepts a reply where every page had text', async () => {
    fetchMock.mockResolvedValue(reply({ ...goodReply, pagesWithoutText: [] }));
    await expect(extractSyllabusText(pdfBytes)).resolves.toMatchObject({ pagesWithoutText: [] });
  });

  it('names the address it tried when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(extractSyllabusText(pdfBytes)).rejects.toThrow(/Could not reach the server at http/);
  });
});
