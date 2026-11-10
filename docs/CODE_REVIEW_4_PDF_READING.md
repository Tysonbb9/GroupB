# Code review, section 4 of 5: reading the PDF

Issue: [#115](https://github.com/Tysonbb9/GroupB/issues/115). Part of the team code review (VV10), tracked in [#111](https://github.com/Tysonbb9/GroupB/issues/111).
Reviewed on 11/10 against `main` at `2ec627d`, using [CodingStandard.md](CodingStandard.md) as the checklist.

## The short version

This section is the code that takes a syllabus PDF a student uploads and pulls the text out of it, so the app can find the assignments. It's in good shape. All the server tests pass, the tricky parts are mostly explained, and the tests are some of the most thorough in the project.

I found six things worth raising. Two of them a student could actually run into:

- **Sideways text gets glued together.** If a syllabus has text turned on its side, two separate lines come out stuck together as one, so two assignments look like one.
- **"1½ hours" turns into "11⁄2 hours".** The app then can't find the hours for that assignment.

The other four are smaller: some unexplained numbers, two layouts that aren't handled and aren't written down, and one error that could get swallowed.

Fixes for all six are written and tested on the branch `fix/115-pdf-reading-review`. Per the card, that pull request waits until we've talked these through at the review session.

One thing to be upfront about: whoever reviewed this section also wrote the code. The team agreed that's allowed, but a second pair of eyes is very welcome.

---

## If you haven't seen this code before

You don't need to read the code to follow this review. Here's what it does.

**A PDF doesn't store lines of text.** You'd think a PDF holds "Week 7: Midterm (8 hours)" as one line. It doesn't. It stores small scraps of text, each with a position on the page, something like:

```
"Week 7:"     at 72 points from the left, 700 points up from the bottom
"Midterm"     at 125 from the left, 700 up
"(8 hours)"   at 185 from the left, 700 up
```

The scraps can come in any order. Our job is to put them back together into lines a person would read.

**Think of it like a torn-up page.** Imagine someone cut a printed page into word-sized strips and handed you the pile, with a note on each strip saying where it sat. To rebuild the page you would:

1. Sort the strips from the top of the page to the bottom.
2. Group strips that sit at the same height into one line.
3. Within each line, put the strips in order from left to right.
4. Add a space wherever there was a visible gap between strips.

That's exactly what our code does. Almost every finding below is about a situation where one of those four steps goes wrong.

**The two files:**

| File | What it does, in plain terms |
| --- | --- |
| `server/src/syllabus/read-pdf.worker.mjs` | Opens the PDF and makes the list of scraps and positions. It runs on its own thread, so a huge or broken PDF can't freeze the server for everyone else. |
| `server/src/syllabus/pdf-text.ts` | Takes that list and rebuilds the lines (steps 1 to 4 above), then tidies up odd characters. |

**Two words that show up below:**

- **Font size** is used as a ruler. Lots of decisions are "is this gap bigger than some fraction of the font size?" That way the same rules work for tiny footnotes and big headings.
- **Baseline** is the invisible line that letters sit on. Letters like "g" and "y" hang below it.

---

## What's going well

- **The worker explains why it's built the way it is.** The comment at the top answers the card's question directly. It's a separate thread so a bad PDF can't hang the server. It's plain JavaScript because the PDF library only ships in a format our test tool can't load.
- **The results don't depend on luck.** The PDF library can hand over the scraps in any order. The code sorts them the same way every time, and says how ties are broken.
- **The tests check rules, not just examples.** Besides normal tests, there are seeded random tests that build 30 random pages each and check that no text is ever lost or invented, that the order the scraps arrive in never changes the answer, and that every line comes out tidy. Because they're seeded, any failure can be replayed exactly.
- **Garbage input is covered.** One test throws in missing positions, infinite numbers, zero and negative font sizes, and broken characters, and checks nothing crashes.
- **Hard cases are tested and explained.** Superscripts like "7th", subscripts, and "fake bold" (some PDFs make text bold by drawing it twice, slightly shifted) each have a test that explains what's going on.
- **The tests use real PDFs.** `testing/pdfs.ts` builds each test PDF in code, so you can see exactly what's on the page. The one saved PDF (a password-protected one) says how it was made and what its password is.
- **A known weakness is written down.** Two columns at the same height get read straight across both columns. That's stated in a comment and pinned by a test.
- **I also checked, and these work fine:** huge headings over small text, very small text, negative font sizes, and pages that are rotated as a whole.

---

## The findings

Severity uses the card's three levels: **must fix**, **should fix**, or **nit**. Nothing here is a must fix.

### 1. Sideways text gets glued together (should fix)

**Where:** `pdf-text.ts:191` (`joinLine`), and the worker at `read-pdf.worker.mjs:33-39`.

**In plain terms:** Picture a table whose column headings are turned on their side. Our code only knows where each scrap *starts*, not which way it *runs*. Two sideways lines both start at the same height, so the code thinks they're one line. Their length runs up the page instead of across it, so the code never sees a gap and doesn't add a space.

**What actually happened:** Two sideways lines came out as `Week 1: Quiz (2 hours)Week 2: Essay (4 hours)`. The scanner would see one assignment with 4 hours instead of two.

**Fix:** The worker now also reports the angle of each scrap. Scraps at the same angle are grouped, and each group is read as if you'd turned the page to read it. Upright text comes first, then the sideways groups. There's a test with a real rotated PDF.

### 2. "1½ hours" becomes "11⁄2 hours" (should fix)

**Where:** `pdf-text.ts:121` (`normalizeText`).

**In plain terms:** After rebuilding a line, we tidy it using a standard Unicode cleanup step. It does a lot of useful things, like turning the single "ﬁ" character back into "f" and "i". But it also breaks "½" into "1", a fraction slash, and "2". So "1½" becomes "11⁄2", which reads like eleven halves.

**What actually happened:** `Week 3: Reading (1½ hours)` came out as `Week 3: Reading (11⁄2 hours)`. The client's scanner only understands plain numbers, so it found no hours at all.

**Fix:** Before the cleanup, "½", "¼" and "¾" are turned into decimals, so "1½" becomes "1.5" and "½" on its own becomes "0.5". I checked end to end: a real PDF with "(1½ hours)" now gives an assignment with 1.5 hours.

### 3. The tuning numbers don't say why (should fix)

**Where:** `pdf-text.ts:133-147` and `191-212`.

**In plain terms:** The whole line-rebuilding process depends on a few "magic numbers" (remember, font size is the ruler):

| Number | What it decides |
| --- | --- |
| 0.8 and 0.2 (`ASCENT`, `DESCENT`) | How far text reaches above and below its baseline |
| 0.5 | How much two scraps must overlap vertically to share a line |
| 0.3 | How close a repeat must be to count as fake bold |
| 0.15 | How wide a gap must be to count as a space |

Only the first two had names, and their comment just said "close enough" without saying where the values came from. The other three were bare numbers in the code. The reason for 0.15 only lived in a test comment. The course asks for comments that explain tricky code (SC5), and these numbers are the trickiest part.

**Fix:** The three bare numbers now have names (`SAME_LINE_OVERLAP`, `FAKE_BOLD_DISTANCE`, `WORD_GAP`), all kept together, each with a line saying why that value works. For example, 0.15 of a 12-point font is 1.8 points: wider than the space between letters, narrower than a real space. `ASCENT` and `DESCENT` now cite real font measurements. None of the values changed, so behavior is exactly the same.

### 4. Offset columns get shuffled together, and it isn't written down (nit)

**Where:** the comment above `pageToLines`, `pdf-text.ts:150-161`.

**In plain terms:** Picture a page with two columns where the right column's lines sit a little lower than the left's. Because we sort strictly top to bottom, we read left, right, left, right, like zig-zagging across a newspaper.

**What actually happened:** Left lines at heights 700 and 684, right lines at 692 and 676, came out as L1, R1, L2, R2.

**Fix:** Written down next to the existing note about columns at the same height, with a "known limit" test. I didn't try to fix it properly. Telling columns apart needs real layout detection, and that could break schedule tables, which currently read correctly.

### 5. Right-to-left text comes out backwards (nit)

**Where:** `pdf-text.ts:191` (`joinLine` always reads left to right).

**In plain terms:** Hebrew and Arabic are written right to left, so the first word sits on the right. We always read left to right, so the words come out in reverse order. The PDF library already tells us each scrap's direction; we just weren't passing it along.

**What actually happened:** Two Hebrew words came out swapped.

**Fix:** The worker now passes the direction through. A line where most scraps are right to left is read right to left. An English line with one Hebrew word in it stays as it was. Unlikely in our syllabi, but it was a small change.

### 6. Tidying up can throw away a good result (nit)

**Where:** `read-pdf.worker.mjs:45-49`.

**In plain terms:** After reading the PDF, the worker frees up memory. If that clean-up step fails, its error replaced the text we'd already read successfully. The student would be told "this PDF couldn't be read" when it actually was.

**Fix:** The clean-up now has its own error handling. If it fails, the error is logged (the coding standard says never to ignore a failure silently) and the text is kept. There's a new test file for it, `pdf-worker.test.ts`.

---

## Summary

| # | Severity | Where | Finding | Status |
| --- | --- | --- | --- | --- |
| 1 | should fix | `pdf-text.ts:191` | Sideways text gets glued together | Fix ready on `fix/115-pdf-reading-review` |
| 2 | should fix | `pdf-text.ts:121` | "1½ hours" becomes "11⁄2 hours" | Fix ready |
| 3 | should fix | `pdf-text.ts:133-147, 191-212` | Tuning numbers don't say why | Fix ready |
| 4 | nit | `pdf-text.ts:150-161` | Offset columns shuffle, not written down | Documented, with a test |
| 5 | nit | `pdf-text.ts:191` | Right-to-left text comes out backwards | Fix ready |
| 6 | nit | `read-pdf.worker.mjs:45-49` | Tidying up can throw away a good result | Fix ready |

**After the fixes:** 320 server tests pass (275 before), and the client's 627 tests are unaffected. The text the server sends back looks exactly as before, so nothing on the client side changes.

**What happens next:** each finding is a comment on #115. We go through them at the review session. If the team agrees, the fix branch becomes one pull request linked from #115. Anything the team would rather not fix gets declined with a reason. The scribe copies the outcomes into `CODE_REVIEW_SERVER_API.md`.

## Ideas for later

Not problems, and none needed this sprint:

- **A couple of real syllabi as test files.** Our test PDFs are tidy because we build them. Two or three real, messy syllabus PDFs (with permission, nothing private in them) would catch layouts nobody thought of.
- **Say what was skipped.** When scraps get dropped (no usable position, or fake bold), nothing reports it. A count would help when a student says "it missed my assignment".
- **One list of known limits.** Same-height columns and offset columns could be listed together in `docs/CODE.md`, so the next person knows what the reader doesn't handle.
