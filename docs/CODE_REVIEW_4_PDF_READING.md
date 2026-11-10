# Code review, section 4 of 5: reading the PDF

Issue: [#115](https://github.com/Tysonbb9/GroupB/issues/115). Part of the team code review (VV10), tracked in [#111](https://github.com/Tysonbb9/GroupB/issues/111).
Reviewer: Colin Redder, 11/10, against `main` at `2ec627d`. Checklist: [CodingStandard.md](CodingStandard.md).

## In plain words

*A short, non-technical summary. The detail starts further down.*

**What was reviewed.** The code that reads the text out of a syllabus PDF and puts it back into lines, so the app can find the assignments in it. A PDF does not store lines of text: it stores small pieces of text and where each one sits on the page. This code works out which pieces belong on the same line and in what order.

**Overall.** The code is in good shape. It is careful, well tested, and explains most of its decisions. All 275 server tests pass. We found two real problems that a student could hit, and four smaller things to tidy up. None of them is urgent enough to block the sprint.

**The two real problems.**
1. **Sideways text runs together.** If a syllabus has text turned on its side (a rotated table or label), two separate lines come out glued together with no space, so two assignments look like one.
2. **"1½ hours" turns into "11⁄2 hours".** A cleanup step changes the ½ sign in a way that reads like eleven halves. The app then finds no hours for that assignment.

**The reviewer wrote this code.** The team agreed authors may review their own section. This is said up front so the team can weigh it, and a second reader is welcome.

**What happens next.** Each finding becomes a comment on #115, is presented at the team review session, and is then either fixed in a pull request or declined with a reason.

---

## 1. What was reviewed

| File | Lines | What it does |
| --- | --- | --- |
| `server/src/syllabus/pdf-text.ts` | 107 to 236 | Rebuilds lines: `sizeOf`, `normalizeText`, `ASCENT` and `DESCENT`, `onSameLine`, `pageToLines`, `joinLine`, `pagesToText` |
| `server/src/syllabus/read-pdf.worker.mjs` | all 60 | Opens the PDF on a separate thread and reports each piece of text with its position |
| `server/src/__tests__/pdf-text.test.ts` | 362 | Tests for the line rebuilding |
| `server/src/testing/pdfs.ts` | 85 | Builds real PDFs in code for the tests |

**How it was reviewed.** The code and tests were read against the coding standard and the card's questions. Each finding was then reproduced by running the real functions on small, made-up inputs, so none of them is a guess. The full server test suite was run on 11/10: 12 suites, 275 tests passing.

## 2. What is going well

- **The worker explains itself.** Its opening comment answers the card's question in full. It runs on its own thread so a slow or hostile PDF cannot freeze the server. It is plain JavaScript because the PDF library (pdf.js) only ships in a format our test tool (Jest) cannot load directly.
- **The result never depends on luck.** The PDF library can report pieces of text in any order. The code sorts them the same way every time and says how ties are broken.
- **The tests prove the important properties, not just examples.** Seeded random tests check, on 30 random pages for each property, that rebuilding lines never loses or invents text, gives the same answer whatever order the pieces arrive in, and always produces tidy lines. Because they are seeded, any failure can be replayed.
- **Hostile input is covered.** A test feeds in missing positions, infinite numbers, zero and negative font sizes, and broken characters, and checks nothing crashes. A sensible fallback font size handles a PDF that reports none.
- **Hard typography is handled and tested.** Superscripts such as "7th", subscripts, and "fake bold" (text drawn twice, slightly offset) each have a test that explains the geometry.
- **Tests use real PDFs.** `testing/pdfs.ts` builds each test PDF in code, so every test shows exactly what is on the page. The one stored file (a password-protected PDF) says how it was made and what its password is.
- **Known limits are written down.** Two columns that share a baseline read across both columns. This is stated in a comment and pinned by a test named as a known limit.
- **Checked and fine:** very large headings over small text, very small text, negative font sizes, and pages turned with the PDF's own page-rotation setting all read correctly.

## 3. What is not going well

Severity follows the card: **must fix**, **should fix**, or **nit**. Nothing here is a must fix.

### Finding 1: sideways text runs two lines together (should fix)

**Where:** `pdf-text.ts:191` (`joinLine`), together with how the worker reports positions, `read-pdf.worker.mjs:33-39`.

**What happens:** Two lines of text drawn turned 90 degrees, at x 100 and x 116 on the page, came out as `Week 1: Quiz (2 hours)Week 2: Essay (4 hours)`: one line, no space. The assignment scanner would see one assignment with 4 hours instead of two.

**Why:** The worker reports only where each piece starts, not which way it runs. Both sideways pieces start at the same height, so they are treated as one line. Their width runs up the page rather than across it, so the gap between them looks negative and no space is added.

**Suggested improvement:** Have the worker also report each piece's angle, and treat a piece that is not horizontal as a line of its own. Add a test that builds a PDF with rotated text. Pages rotated with the PDF's page-rotation setting already work, so this is only for text drawn at an angle.

### Finding 2: "1½ hours" becomes "11⁄2 hours" (should fix)

**Where:** `pdf-text.ts:121` (`normalizeText`).

**What happens:** `Week 3: Reading (1½ hours)` comes out as `Week 3: Reading (11⁄2 hours)`. The assignment scanner (`client/src/lib/inputs.ts:39`) only understands plain numbers, so it finds no hours. The student sees "11⁄2" in the title, which reads like 11 over 2.

**Why:** The cleanup uses a standard Unicode step (NFKC) that splits the ½ sign into "1", a fraction slash, and "2". That is right for most characters, but not for fractions that follow a number.

**Suggested improvement:** Before that step, turn the common fraction signs into decimals: "1½" into "1.5", "½" into "0.5", and the same for ¼ and ¾. The scanner would then read 1.5 hours. Add a test for "(1½ hours)".

### Finding 3: the tuning numbers do not say why (should fix)

**Where:** `pdf-text.ts:133-147` and `191-212`.

**What happens:** Line rebuilding depends on five numbers:
- `ASCENT` and `DESCENT`, how far text reaches above and below its baseline;
- 0.5, how much two pieces must overlap to share a line;
- 0.3, how close a repeat must be to count as fake bold;
- 0.15, how wide a gap must be to count as a space.

Only `ASCENT` and `DESCENT` have a name, and their comment says "close enough for every common font" without saying where the values come from. The other three appear as bare numbers. The reason for 0.15 (about 1.8 points at 12-point text, wider than the spacing between letters) is written only in a test comment. The course asks for comments that explain tricky code (SC5), and these numbers are the trickiest part.

**Suggested improvement:** Give the three bare numbers names next to `ASCENT` (for example `SAME_LINE_OVERLAP`, `FAKE_BOLD_DISTANCE` and `WORD_GAP`), each with one line saying why that value. Give `ASCENT` and `DESCENT` a source: in Helvetica, text rises about 0.72 of the font size above the baseline and drops about 0.21 below.

### Finding 4: offset columns mix line by line, and this is not written down (nit)

**Where:** the comment above `pageToLines`, `pdf-text.ts:150-161`.

**What happens:** A page with two columns whose lines sit at slightly different heights (left lines at 700 and 684, right lines at 692 and 676) reads as left, right, left, right. The columns are mixed together line by line.

**Suggested improvement:** Mention this next to the existing note about columns that share a baseline, and add a "known limit" test the same way.

### Finding 5: right-to-left text comes out backwards (nit)

**Where:** `pdf-text.ts:191` (`joinLine` puts pieces in order from left to right).

**What happens:** Two Hebrew words, the first drawn to the right of the second as Hebrew is written, came out in reverse order. The PDF library reports which direction each piece runs, but the worker does not pass that on.

**Suggested improvement:** Unlikely in our syllabi, so record it as a known limit with a test. If it ever matters, pass the direction through and reverse right-to-left lines.

### Finding 6: a failed cleanup can throw away a good result (nit)

**Where:** `read-pdf.worker.mjs:45-49`.

**What happens:** After reading the pages, the worker frees the PDF's memory inside a `finally` block and waits for that to finish. If freeing the memory fails, that error replaces the pages that were already read successfully. The student would be told the PDF could not be read when it was.

**Suggested improvement:** Put the cleanup in its own `try`/`catch` that logs the error and keeps the result. The thread is stopped right after anyway, and the coding standard asks that no failure be ignored silently, so it should be logged, not dropped.

## 4. Summary of findings

| # | Severity | Where | Finding | Resolution |
| --- | --- | --- | --- | --- |
| 1 | should fix | `pdf-text.ts:191` | Sideways text runs two lines together | to decide at the session |
| 2 | should fix | `pdf-text.ts:121` | "1½ hours" becomes "11⁄2 hours" | to decide at the session |
| 3 | should fix | `pdf-text.ts:133-147, 191-212` | The tuning numbers do not say why | to decide at the session |
| 4 | nit | `pdf-text.ts:150-161` | Offset columns mix, not written down | to decide at the session |
| 5 | nit | `pdf-text.ts:191` | Right-to-left text comes out backwards | to decide at the session |
| 6 | nit | `read-pdf.worker.mjs:45-49` | A failed cleanup can throw away a good result | to decide at the session |

After the session, the Resolution column records each outcome: fixed in a pull request (with its number), or declined with the reason. The scribe copies this into the team's record, `CODE_REVIEW_SERVER_API.md`.

## 5. Possible improvements beyond the findings

These are not problems, just ideas for later. None is needed this sprint.

- **A few real syllabi as test fixtures.** The tests build tidy PDFs in code. Two or three real, messy syllabus PDFs (with permission, and with nothing private in them) would catch layouts nobody thought to build.
- **Report what was skipped.** When pieces of text are dropped (no usable position, or fake bold), nothing says so. A count in the result would help when a student says "it missed my assignment".
- **One place for the "known limits".** Two-column pages, offset columns, right-to-left text and sideways text could be listed together in one comment or in `docs/CODE.md`, so the next person knows what the reader does not handle.
