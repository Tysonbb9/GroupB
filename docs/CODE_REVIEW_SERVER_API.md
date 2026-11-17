# Team code review record: server API and data layer (VV10)

The written record of the team code review of the server API and data layer.
Tracked in the umbrella issue [#111](https://github.com/Tysonbb9/GroupB/issues/111).

- **Session:** Wednesday 11/11 at 9:30 pm, on Teams.
- **Checklist:** [CodingStandard.md](CodingStandard.md).
- **Reviewed against:** `main` after the data layer (PR [#121](https://github.com/Tysonbb9/GroupB/pull/121)) merged.
- **Scribe:** TJ.


> **Status of this record:** All five sections have been reviewed and resolved, and their fix PRs have been merged into `main`. Issues #112 and #116 are closed. The database migration associated with Section 5 still requires deployment verification.


## Attendance

All six team members attended: Tyson Bobeldyk, Gabby Odhiambo, Nhyira Mante,TJ French, Bithiah Botsha, Colin Redder.

## The five sections

The reviewing was split into five section issues, one per reviewer. Each
reviewer posted their findings as comments on their issue before the session,
presented them at the session, and the author of each section responded. Every
finding ended either fixed in a PR or declined with a reason.

| Section | Issue | Reviewer | Findings | Resolved in | Status |
| --- | --- | --- | --- | --- | --- |
| 1. Read routes | [#112](https://github.com/Tysonbb9/GroupB/issues/112) | TJ | 4 | PR [#171](https://github.com/Tysonbb9/GroupB/pull/171), PR [#174](https://github.com/Tysonbb9/GroupB/pull/174) | Closed |
| 2. Write routes, reviews, request handling | [#113](https://github.com/Tysonbb9/GroupB/issues/113) | Gabby | 6 | PR [#167](https://github.com/Tysonbb9/GroupB/pull/167) | Closed |
| 3. PDF endpoint and safety checks | [#114](https://github.com/Tysonbb9/GroupB/issues/114) | Tyson | 9 | PR [#151](https://github.com/Tysonbb9/GroupB/pull/151) | Closed |
| 4. Reading the PDF: worker and lines | [#115](https://github.com/Tysonbb9/GroupB/issues/115) | Colin | 6 | PR [#150](https://github.com/Tysonbb9/GroupB/pull/150) | Closed |
| 5. Data, configuration, database layer | [#116](https://github.com/Tysonbb9/GroupB/issues/116) | Bithiah | 2 | PR [#201](https://github.com/Tysonbb9/GroupB/pull/201) | Closed |



Severity uses the card's three levels: **must fix**, **should fix**, **nit**.
A fourth label, **needs team decision**, was used once in section 1 and was
settled at the session.

## Findings register

Every finding, its severity, and how it was resolved. "Fixed in #NNN" means the
fix is merged on `main`. "Declined" means the team agreed to leave it as is,
with the reason given.

### Section 1 — Read routes ([#112](https://github.com/Tysonbb9/GroupB/issues/112), reviewer TJ)

| # | Where | Severity | Resolution |
| --- | --- | --- | --- |
| 1 | `app.ts:87` — `?week=` (empty) passes validation because `Number('')` is `0`, so the request returns `200 []` instead of `400` | should fix | **Fixed in [#174](https://github.com/Tysonbb9/GroupB/pull/174)** — Updated `GET /tasks` to reject empty and whitespace-only week values with HTTP 400 and a JSON error. Added automated tests covering invalid week parameters.|
| 2 | `app.ts:100` — unknown/empty filters (`?courseId=nope`, `?courseId=`, `?week=99`) return `200 []` with no validation | needs team decision | **Fixed in [#174](https://github.com/Tysonbb9/GroupB/pull/174)** — The team agreed in [#109](https://github.com/Tysonbb9/GroupB/issues/109) that an unknown `courseId` returns `200` with an empty list, while invalid, out-of-range, or empty `week` values return `400` with a JSON error. The week-validation changes and tests were merged in PR #174.|
| 3 | `tasks.test.ts:23-33` — eight read-route tests are still `it.todo` placeholders | must fix |**Fixed in [#171](https://github.com/Tysonbb9/GroupB/pull/171)** — Bithiah implemented eight automated read-endpoint tests (TP-08 to TP-13 and TP-16 to TP-17), replacing the existing `it.todo` placeholders. The remaining week-validation tests (TP-14 and TP-15) were completed in [#174](https://github.com/Tysonbb9/GroupB/pull/174). Both PRs were merged into `main`.|
| 4 | `app.ts:51-73` — `GET /courses/:id` and `GET /tasks/:id` repeat the same fetch/404/return shape | nit | **Declined** — only two occurrences; a helper is not worth it until a third single-resource route appears. (Team nit policy: nits are not actioned.) |

### Section 2 — Write routes, reviews and request handling ([#113](https://github.com/Tysonbb9/GroupB/issues/113), reviewer Gabby)

All fixes merged in PR [#167](https://github.com/Tysonbb9/GroupB/pull/167).

| # | Where | Severity | Resolution |
| --- | --- | --- | --- |
| 1 | `app.ts:294` — a body that is not valid JSON returns `500` and is logged as a server failure | must fix | **Fixed in [#167](https://github.com/Tysonbb9/GroupB/pull/167)** — `entity.parse.failed` now returns `400` with `{ error }` and is not logged as a failure. |
| 2 | `tasks.test.ts:51` — no test proves a half-update can't happen (one good field, one bad) | should fix | **Fixed in [#167](https://github.com/Tysonbb9/GroupB/pull/167)** — test sends `{ done: true, estimatedHours: -1 }`, expects `400`, then confirms the task is unchanged. |
| 3 | `app.ts:166` — the "more than 0, up to 100" hours check is written out three times | should fix | **Fixed in [#167](https://github.com/Tysonbb9/GroupB/pull/167)** — one `isValidHours()` helper with a `MAX_HOURS = 100` constant, used in all three routes. |
| 4 | `reviews.test.ts:44` — `POST /courses/:id/reviews` only tests `hours = 0` | should fix | **Fixed in [#167](https://github.com/Tysonbb9/GroupB/pull/167)** — `it.each` added: 100 accepted; 101, -1 and "5" return 400. |
| 5 | `cors.test.ts` — no test sends a broken JSON body | should fix | **Fixed in [#167](https://github.com/Tysonbb9/GroupB/pull/167)** — test sends `'{bad'` with `application/json` and expects `400` with `{ error }`. |
| 6 | `reviews.test.ts:51` — `GET /courses/:id/reviews` has no test for an unknown course | should fix | **Fixed in [#167](https://github.com/Tysonbb9/GroupB/pull/167)** — `GET /courses/nope/reviews` expects `404`. |

### Section 3 — The PDF endpoint and its safety checks ([#114](https://github.com/Tysonbb9/GroupB/issues/114), reviewer Tyson)

All fixes merged in PR [#151](https://github.com/Tysonbb9/GroupB/pull/151).

| # | Where | Severity | Resolution |
| --- | --- | --- | --- |
| 1 | `routes.ts:51` — non-`PdfReadError` errors go to a generic 500 and are never logged | must fix | **Fixed in [#151](https://github.com/Tysonbb9/GroupB/pull/151)** — the error is logged (`console.error`) before the generic 500; the student's message stays generic. |
| 2 | `pdf-text.ts:286-290` — no cap on concurrent PDF reads; a burst of uploads could ask for gigabytes | should fix | **Fixed in [#151](https://github.com/Tysonbb9/GroupB/pull/151)** — `MAX_CONCURRENT_PDF_READS = 3`; beyond that the route answers `503` (`busy`). |
| 3 | `pdf-text.ts:247-254` — the error-name list treats our own bugs as file faults | should fix | **Fixed in [#151](https://github.com/Tysonbb9/GroupB/pull/151)** — only genuine file-fault errors become a `PdfReadError`; the rest fall through to a logged 500. |
| 4 | `pdf-text.ts:277` — the worker `.mjs` file is not copied by `tsc` into `dist/` | should fix (verify) | **Fixed in [#151](https://github.com/Tysonbb9/GroupB/pull/151)** — the worker file is copied into the build and its presence is checked. |
| 5 | `routes.ts:34,48,51,63` — the `{ error, code }` response is written by hand in four spots | should fix | **Fixed in [#151](https://github.com/Tysonbb9/GroupB/pull/151)** — one `sendPdfError()` helper; the 500 now carries a `server_error` code. |
| 6 | `routes.ts:61-68` — some body-reading errors skip the JSON shape and return HTML | should fix | **Fixed in [#151](https://github.com/Tysonbb9/GroupB/pull/151)** — a router-level `bodyReadError` handler answers every body-read error in the JSON shape (`bad_upload`). |
| 7 | `pdf-text.ts:78-91`, `routes.ts:35` — several messages say what's wrong but not what to do | nit | **Fixed in [#151](https://github.com/Tysonbb9/GroupB/pull/151)** — messages end with the same fallback ("...or paste the syllabus text instead"). |
| 8 | `routes.ts:25` — `timeout` returns 422, blaming the student for what can be server load | nit (discussion) | **Fixed in [#151](https://github.com/Tysonbb9/GroupB/pull/151)** — `timeout` now maps to `503`, with a comment explaining why. |
| 9 | `syllabus-route.test.ts:18-94` — several status codes, the exact 10 MB limit, signature offsets, worker failures and logging are untested | should fix | **Fixed in [#151](https://github.com/Tysonbb9/GroupB/pull/151)** — `it.each` over every `PdfReadError` code, the exact-size and signature-offset cases, and the logging check were added. |

### Section 4 — Reading the PDF: the worker and rebuilding lines ([#115](https://github.com/Tysonbb9/GroupB/issues/115), reviewer Colin)

All six fixes merged in PR [#150](https://github.com/Tysonbb9/GroupB/pull/150). Full write-up: [CODE_REVIEW_4_PDF_READING.md](CODE_REVIEW_4_PDF_READING.md).

| # | Where | Severity | Resolution |
| --- | --- | --- | --- |
| 1 | `pdf-text.ts:191` (`joinLine`), worker `:33-39` — sideways text runs two lines together | should fix | **Fixed in [#150](https://github.com/Tysonbb9/GroupB/pull/150)** — the worker reports each run's angle and each angle is read as its own group, so rotated lines no longer run together. |
| 2 | `pdf-text.ts:121` (`normalizeText`) — NFKC splits "½" so "1½ hours" becomes "11⁄2 hours" | should fix | **Fixed in [#150](https://github.com/Tysonbb9/GroupB/pull/150)** — ½, ¼ and ¾ become decimals before NFKC, so the scanner reads 1.5 hours. |
| 3 | `pdf-text.ts:133-147,191-212` — five tuning numbers, only two named | should fix | **Fixed in [#150](https://github.com/Tysonbb9/GroupB/pull/150)** — `SAME_LINE_OVERLAP`, `FAKE_BOLD_DISTANCE` and `WORD_GAP` named, every constant now says where its value comes from. Values unchanged. |
| 4 | `pageToLines` comment — offset two-column pages read left/right/left/right | nit | **Fixed in [#150](https://github.com/Tysonbb9/GroupB/pull/150)** — documented as a known limit with a test. Not fixed properly: telling columns apart needs layout analysis and could break schedule tables. |
| 5 | `pdf-text.ts:191` (`joinLine`) — right-to-left text comes out reversed | nit | **Fixed in [#150](https://github.com/Tysonbb9/GroupB/pull/150)** — the worker passes pdf.js's direction through and mostly-RTL lines are mirrored. |
| 6 | `read-pdf.worker.mjs:45-49` — a failure freeing PDF memory replaces an already-read result | nit | **Fixed in [#150](https://github.com/Tysonbb9/GroupB/pull/150)** — clean-up gets its own try/catch that logs and keeps the result (`freeMemory`). |

### Section 5 — Data, configuration and the new database layer ([#116](https://github.com/Tysonbb9/GroupB/issues/116), reviewer Bithiah)

Both findings were resolved in commit `7b892c0` and merged into `main` through [PR #201](https://github.com/Tysonbb9/GroupB/pull/201). Issue #116 is closed. The changes passed typechecking and 699 automated tests across 32 suites. 




| # | Where | Severity | Resolution |
| --- | --- | --- | --- |
| 1 | `supabase-store.ts:185-210` — task IDs are generated by reading existing IDs first, so concurrent requests can pick the same next ID | should fix | **Fixed in [#201](https://github.com/Tysonbb9/GroupB/pull/201)** — Replaced client-side task ID generation with PostgreSQL RPC `add_student_tasks`, using a per-student transaction advisory lock. Preserved the `<course>-syl-N` ID format and added `server/db/migration_atomic_task_ids.sql`. |
| 2 | `create-store.ts:5-13` — incomplete Supabase configuration silently falls back to `MemoryStore` | should fix | **Fixed in [#201](https://github.com/Tysonbb9/GroupB/pull/201)** — Updated `createStore()` to use `MemoryStore` when neither Supabase variable is configured, use `SupabaseStore` when both are present, and throw a descriptive error when only one is set. Added four configuration tests. |

## Decisions made at the session

- **Nit policy:** nits are noted but not actioned unless a fix is already
  written and cheap (as in section 4, where Colin had them ready). Section 1's
  duplicate-404 nit was declined on this basis.
- **Who fixes what:** Gabby did all of section 2's fixes; Tyson did section 3
  except as noted; Colin's section 4 fixes were already written and merged;
  Bithiah completes section 1's to-do tests and both of section 5's findings,
  and decides how to fix her first finding; TJ reviewed section 1 and is the
  scribe.
- **Filter behavior (section 1, finding 2):** settled in
  [#109](https://github.com/Tysonbb9/GroupB/issues/109) — unknown `courseId`
  returns an empty list, but a non-numeric, out-of-range, or empty `week`
  returns `400`.


## Open items

All five code review sections have been resolved and their PRs merged.

- [x] Section 1 ([#112](https://github.com/Tysonbb9/GroupB/issues/112)) — findings 1, 2 and 3 resolved in merged PRs [#171](https://github.com/Tysonbb9/GroupB/pull/171) and [#174](https://github.com/Tysonbb9/GroupB/pull/174). Finding 4 declined by team agreement. Issue #112 closed.
- [x] Section 5 ([#116](https://github.com/Tysonbb9/GroupB/issues/116)) — both findings resolved in merged [PR #201](https://github.com/Tysonbb9/GroupB/pull/201). Issue #116 closed.
- [x] Close Issues #112 and #116 following their merged PRs.