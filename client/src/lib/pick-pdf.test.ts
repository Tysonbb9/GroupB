import * as DocumentPicker from 'expo-document-picker';
import { pickPdf } from './pick-pdf';

/** pickPdf (US-29). The real picker opens a system window, so it is replaced. */
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
const getDocumentAsync = DocumentPicker.getDocumentAsync as jest.Mock;

const fetchMock = jest.fn();
const realFetch = globalThis.fetch;

beforeEach(() => {
  getDocumentAsync.mockReset();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

describe('pickPdf', () => {
  it('asks the picker for PDFs only', async () => {
    getDocumentAsync.mockResolvedValue({ canceled: true, assets: null });
    await pickPdf();
    expect(getDocumentAsync).toHaveBeenCalledWith(expect.objectContaining({ type: 'application/pdf' }));
  });

  it('answers null when the student cancels', async () => {
    getDocumentAsync.mockResolvedValue({ canceled: true, assets: null });
    await expect(pickPdf()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hands back the File on the web', async () => {
    const file = new Blob(['%PDF-1.7']);
    getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'blob:x', name: 'syllabus.pdf', file }],
    });
    await expect(pickPdf()).resolves.toBe(file);
  });

  it('reads the local file on a phone', async () => {
    const blob = new Blob(['%PDF-1.7']);
    fetchMock.mockResolvedValue({ blob: async () => blob });
    getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/syllabus.pdf', name: 'syllabus.pdf' }],
    });

    await expect(pickPdf()).resolves.toBe(blob);
    expect(fetchMock).toHaveBeenCalledWith('file:///cache/syllabus.pdf');
  });
});