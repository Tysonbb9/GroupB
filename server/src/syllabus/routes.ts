import express, { ErrorRequestHandler } from 'express';
import { extractPdfText, MAX_PDF_BYTES, PDF_ERROR_MESSAGES, PdfErrorCode, PdfReadError } from './pdf-text';

/**
 * POST /syllabus/text
 *
 * Body: the PDF's bytes, sent with Content-Type: application/pdf.
 * Answers with { text, pageCount, lineCount, pagesWithoutText }, where
 * text is every line in reading order, for the client's syllabus scanner.
 *
 * Problems with the file come back as { error, code } with a message the
 * student can act on: 400 nothing sent, 413 too big, 415 not a PDF,
 * 422 a PDF we cannot get text from (locked, damaged, scanned, too long).
 */
export const syllabusRouter = express.Router();

const STATUS: Record<PdfErrorCode, number> = {
  empty: 400,
  too_large: 413,
  not_pdf: 415,
  too_many_pages: 422,
  encrypted: 422,
  unreadable: 422,
  too_complex: 422,
  timeout: 422,
  no_text: 422,
};

syllabusRouter.post(
  '/text',
  express.raw({ type: 'application/pdf', limit: MAX_PDF_BYTES }),
  async (req, res) => {
    if (!req.is('application/pdf')) {
      res.status(415).json({
        error: 'Send the PDF with Content-Type: application/pdf.',
        code: 'not_pdf',
      });
      return;
    }

    const body: unknown = req.body;
    const bytes = Buffer.isBuffer(body) ? body : Buffer.alloc(0);

    try {
      res.json(await extractPdfText(bytes));
    } catch (error) {
      if (error instanceof PdfReadError) {
        res.status(STATUS[error.code]).json({ error: error.message, code: error.code });
        return;
      }
      res.status(500).json({ error: 'Something went wrong reading the PDF.' });
    }
  }
);

/**
 * A PDF over the limit is refused by express.raw before the handler runs.
 * Answer that in the same JSON shape as every other problem. Only errors from
 * this router reach here, so the rest of the server is unaffected.
 */
const tooLarge: ErrorRequestHandler = (error, _req, res, next) => {
  if (error?.type === 'entity.too.large') {
    res.status(413).json({ error: PDF_ERROR_MESSAGES.too_large, code: 'too_large' });
    return;
  }
  next(error);
};
syllabusRouter.use(tooLarge);
