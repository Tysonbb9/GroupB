# Crunch Week server

Express + TypeScript REST API for the Crunch Week app. The database is
**mocked**: data is hardcoded in `src/data/semester.ts` and held in memory,
so changes are lost when the server restarts.

## Run it

```bash
cd server
npm install
npm run dev        # http://localhost:3000, restarts on save
```

## Test it

```bash
npm test           # Jest + Supertest, tests in src/__tests__/
npm run typecheck
```

## API

All responses are JSON. Errors look like `{ "error": "message" }`. The server
allows requests from any web address (CORS), so the browser version of the
client can use it.

| Method | Path | Description | Success | Errors |
|---|---|---|---|---|
| GET | `/semester` | Whole semester: label, current week, capacity, courses, tasks | 200 | |
| GET | `/courses` | All courses | 200 | |
| GET | `/courses/:id` | One course | 200 | 404 |
| GET | `/tasks` | All tasks. Filters: `?courseId=`, `?week=`, `?done=true\|false` | 200 | 400 bad `week` or `done` |
| GET | `/tasks/:id` | One task | 200 | 404 |
| PATCH | `/tasks/:id` | Update `done` and/or `estimatedHours` | 200 | 400 bad body, 404 |
| POST | `/syllabus/text` | A syllabus PDF in (`Content-Type: application/pdf`), its text out | 200 | 400 empty, 413 over 10 MB, 415 not a PDF, 422 no text / locked / damaged / over 50 pages |
| POST | `/courses/:id/reviews` | Add a review: assignment `title`, `hours` (over 0, up to 100), optional `comment` | 201 | 400 bad body, 404 |
| GET | `/courses/:id/reviews` | Reviews of one course | 200 | 404 |


### Example: mark a task done

```http
PATCH /tasks/262-2
Content-Type: application/json

{ "done": true }
```

Response `200`:

```json
{ "id": "262-2", "courseId": "cs262", "title": "Vision statement",
  "category": "writing", "dueWeek": 3, "estimatedHours": 2, "done": true }
```

### Example: read a syllabus PDF

```bash
curl -X POST -H 'Content-Type: application/pdf' --data-binary @syllabus.pdf http://localhost:3000/syllabus/text
```

Response `200`, one line of the PDF per line of `text`, in reading order:

```json
{ "text": "Week 4: Lab report (12 hours)\nWeek 9: Quiz",
  "pageCount": 1, "lineCount": 2, "pagesWithoutText": [] }
```

Problems come back as `{ "error", "code" }`, and `error` says what to do. A
scanned syllabus (pictures of pages, no real text) answers `422` with code
`no_text` and suggests pasting the text instead. `pagesWithoutText` lists any
pages that were only images in a PDF that otherwise had text.

**How it reads PDFs.** [pdf.js](https://mozilla.github.io/pdf.js/) (through the
`unpdf` package) finds every piece of text and where it sits.
`src/syllabus/pdf-text.ts` puts those back into lines: pieces on the same
baseline become one line (so a schedule table reads as one row per line),
superscripts stay on their line, and ligatures and invisible characters are
tidied. The PDF is opened in a worker thread with a 15-second limit and a
memory cap, so a slow or hostile file cannot freeze the server.

**What it cannot do.** It does not read scanned images (that would need
OCR), and two columns of text side by side read across both columns.

## Files

- `src/index.ts`: starts the server
- `src/app.ts`: all routes, apart from the syllabus router it mounts
- `src/syllabus/routes.ts`: `POST /syllabus/text`
- `src/syllabus/pdf-text.ts`: checks the upload and rebuilds lines from the PDF's text
- `src/syllabus/read-pdf.worker.mjs`: opens the PDF with pdf.js, in a worker thread. Plain JavaScript because pdf.js is an ES module, which the CommonJS server and Jest cannot load directly
- `src/testing/pdfs.ts`: builds real PDFs for the tests; `src/testing/fixtures/password-protected.pdf` is a locked one
- `src/types.ts`: Task, Course, Semester (copied from the client), Review and Inputs
- `src/data/semester.ts`: the mock data
- `src/data/db.ts`: in-memory copy of the data, plus `resetDb()` for tests.