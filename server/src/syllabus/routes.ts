import express, { ErrorRequestHandler, Response } from 'express';
import { extractPdfText, MAX_PDF_BYTES, PDF_ERROR_MESSAGES, PdfErrorCode, PdfReadError } from './pdf-text';

/**
 * POST /syllabus/text
 *
 * Body: the PDF's bytes, sent with Content-Type: application/pdf.
 * Answers with { text, pageCount, lineCount, pagesWithoutText }, where
 * text is every line in reading order, for the client's syllabus scanner.
 *
 * Every problem comes back as { error, code } with a message the student can
 * act on, built in one place (sendPdfError):
 *   400 nothing sent, or an upload that could not be read (bad_upload)
 *   413 too big
 *   415 not a PDF
 *   422 a PDF we cannot get text from (locked, damaged, scanned, too long)
 *   500 our own bug (server_error), logged on the server
 *   503 the server cannot read it right now: too many PDFs at once (busy),
 *       or this one took too long (timeout)
 */
export const syllabusRouter = express.Router();

/**
 * Most PDFs read at the same moment. Each one starts a worker with its own
 * memory limit (see pdf-text.ts), so without a cap a burst of uploads could
 * ask the server for gigabytes. Beyond this, answer 503 and let the student
 * retry. Once sign-in lands (US-21), this route should require it.
 */
export const MAX_CONCURRENT_PDF_READS = 3;

/** Codes that come from this router, not from reading the PDF. */
type RouteErrorCode = PdfErrorCode | 'busy' | 'bad_upload' | 'server_error';

/** One message per code. The student sees these, so each says what to try next. */
const MESSAGES: Record<RouteErrorCode, string> = {
  ...PDF_ERROR_MESSAGES,
  busy: 'The server is busy reading other PDFs. Wait a moment and try again, or paste the syllabus text instead.',
  bad_upload: 'The upload could not be read. Try again, or paste the syllabus text instead.',
  server_error: 'Something went wrong reading the PDF. Try again, or paste the syllabus text instead.',
};

const STATUS: Record<PdfErrorCode, number> = {
  empty: 400,
  too_large: 413,
  not_pdf: 415,
  too_many_pages: 422,
  encrypted: 422,
  unreadable: 422,
  too_complex: 422,
  // 503, not 422: a timeout can be the server's load as much as the file's
  // fault, so it must not tell the student their file is bad.
  timeout: 503,
  no_text: 422,
};

/** The one place an error response is written, so every one has { error, code }. */
function sendPdfError(
  res: Response,
  status: number,
  code: RouteErrorCode,
  message: string = MESSAGES[code]
): void {
  res.status(status).json({ error: message, code });
}

let activeReads = 0;

syllabusRouter.post(
  '/text',
  express.raw({ type: 'application/pdf', limit: MAX_PDF_BYTES }),
  async (req, res) => {
    if (!req.is('application/pdf')) {
      sendPdfError(res, 415, 'not_pdf');
      return;
    }

    const body: unknown = req.body;
    const bytes = Buffer.isBuffer(body) ? body : Buffer.alloc(0);

    if (activeReads >= MAX_CONCURRENT_PDF_READS) {
      sendPdfError(res, 503, 'busy');
      return;
    }

    activeReads += 1;
    try {
      res.json(await extractPdfText(bytes));
    } catch (error) {
      if (error instanceof PdfReadError) {
        sendPdfError(res, STATUS[error.code], error.code, error.message);
        return;
      }
      // Not the file's fault: a worker crash, running out of memory, or a bug.
      // Keep the cause in the log and keep the student's message generic.
      console.error('Syllabus PDF read failed:', error);
      sendPdfError(res, 500, 'server_error');
    } finally {
      activeReads -= 1; // on every path, or the cap would fill up for good
    }
  }
);

/**
 * Errors from reading the request body, before the handler runs: a PDF over
 * the limit, an aborted upload, a wrong Content-Length, an unsupported
 * Content-Encoding. Answer all of them in the same JSON shape as every other
 * problem, so the client never gets an HTML error page it cannot read. Only
 * errors from this router reach here, so the rest of the server is unaffected.
 */
const bodyReadError: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error); // too late to change the answer; Express closes the connection
    return;
  }

  if (error?.type === 'entity.too.large') {
    sendPdfError(res, 413, 'too_large');
    return;
  }

  const status: unknown = error?.status ?? error?.statusCode;
  if (typeof status === 'number' && Number.isInteger(status) && status >= 400 && status < 500) {
    sendPdfError(res, status, 'bad_upload'); // the sender's problem: keep its status
    return;
  }

  console.error('Syllabus upload failed:', error);
  sendPdfError(res, 500, 'server_error');
};
syllabusRouter.use(bodyReadError);
