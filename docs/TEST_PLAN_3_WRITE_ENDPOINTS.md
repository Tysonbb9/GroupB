# Test plan 3 of 4: the write endpoint (TP-19 to TP-29)

Issue: [#110](https://github.com/Tysonbb9/GroupB/issues/110). Part of the server API test plan, [TEST_PLAN_SERVER_API.md](TEST_PLAN_SERVER_API.md).
Written 11/10 against `main` at `2ec627d`.

## In plain words

*A short, non-technical summary. The detail starts further down.*

**What this is.** A plan for checking how the server changes a task: marking it done, or setting or clearing how many hours it should take (`PATCH /tasks/:id`). Eleven checks, numbered TP-19 to TP-29 in the main test plan. Two of them (TP-25 and TP-26) were finished in #118, so nine are left.

**What we already know.** We tried each request against the server on 11/10. Seven of the nine behave the way the team agreed, so their checks only need writing down as tests. Two do not:
- A garbled request (broken JSON) gets "Internal server error" (500), as if the server itself broke. It should say the request was bad (400).
- A request that asks to change nothing (`{}`) is accepted and answers "OK" (200). The team agreed it should say there was nothing to update (400).

**What changes in the code.** Two small additions in `server/src/app.ts`: one line of handling for broken JSON in the shared error handler, and one check in the PATCH route for a request with nothing to change.

**Earlier blocker, now gone.** The card said to wait for the data layer (PR #121) before the two fixes. #121 is merged, so everything can start now.

**How long.** About 2 to 3 hours.

**Done when.** All eleven checks are automated tests that pass in CI, the broken-JSON problem is fixed, every error the PATCH route gives is JSON, and the main test plan marks the rows as existing.

---

## 1. Where things stand

| | |
| --- | --- |
| Test file | `server/src/__tests__/taskts.test.ts`, the `PATCH /tasks/:id` group |
| Code under test | `server/src/app.ts`: the PATCH route (from line 117) and the shared error handler (from line 263) |
| Placeholders today | 6 rows (TP-19 to TP-24) are `it.todo` lines. TP-27, TP-28 and TP-29 have none. |
| Model to copy | TP-18 (mark a task done) already exists: it changes the task, then asks for it again to prove the change stuck. |
| Server tests today | 12 suites pass: 275 tests pass, 3 are skipped, 13 are placeholders. |
| Sample data | Every test starts from fresh sample data, because the file already resets it before each test. Task `262-2` starts not done, with an estimate of 2 hours. |

## 2. The eleven checks

"Today" is what the server did when we sent the request on 11/10, using the sample data with no database.

| Row | What we send | What should happen | Today | Work |
| --- | --- | --- | --- | --- |
| TP-19 | Set the estimate to 4 | 200, and asking again shows 4 | correct | write the test |
| TP-20 | Clear the estimate (`null`) | 200, and asking again shows no estimate | correct | write the test |
| TP-21 | Done is "yes" instead of true or false | 400 with a JSON error | correct | write the test |
| TP-22 | A negative estimate | 400 with a JSON error | correct | write the test |
| TP-23 | Done is true, but the estimate is negative | 400, and asking again shows nothing changed (still not done, still 2 hours) | correct | write the test |
| TP-24 | Any change to a task that does not exist | 404 with a JSON error | correct | write the test |
| TP-25 | An estimate of 0 | 400 | done in #118 | none |
| TP-26 | An estimate over 100 | 400 | done in #118 | none |
| TP-27 | Broken JSON, such as `{"done":` | 400 with a JSON error | **500 "Internal server error"** | test, then fix |
| TP-28 | An empty request, `{}` | 400, "nothing to update" (agreed) | **200, and the task is unchanged** | test, then fix |
| TP-29 | Done is true, plus a field the server does not know (`colour`) | the unknown field is ignored, and nothing else changes | correct | write the test |

For TP-27, the test has to send the broken text as it is. Sending it as an object would turn it into valid JSON and test nothing.

## 3. Cases the eleven rows miss

We tried these too. Most are covered by the TP-28 fix, so they belong in the same tests.

| What we send | Today | Should be |
| --- | --- | --- |
| No request body at all | 200, unchanged | 400, covered by the TP-28 fix |
| A list (`[]`) instead of an object | 200, unchanged | 400, covered by the TP-28 fix |
| Only a field the server does not know | 200, unchanged | 400: only known fields count, so this is also "nothing to update" |
| Broken JSON | also prints a full error trace in the server's log | no trace: broken input is the sender's mistake, not a server failure |
| A change to a path that does not exist (`PATCH /nope`) | 404 as a web page, not JSON | Outside these rows. Raise it with the team, and open an issue if they agree. |

## 4. The fixes

**Broken JSON (TP-27).** When the server cannot read a request body as JSON, the part of Express that reads it (body-parser) reports the problem with the type `entity.parse.failed` and the status 400. Our shared error handler only looks for "request too large" and "database unavailable", so this falls through to the general 500. The fix is one more case in that handler, next to the "too large" case and before the line that logs the error, answering 400 with a message such as "The request body is not valid JSON".

**Nothing to update (TP-28).** The PATCH route checks each field it knows (`done` and `estimatedHours`), but never checks that at least one was sent. The fix is one check after the field checks: when neither is present, answer 400 with "Nothing to update: send done or estimatedHours". The 404 for an unknown task stays first, so a missing task is still reported as missing.

## 5. Making sure every error is JSON

The card asks that "the error format is always JSON." Every error check in this plan (TP-21 to TP-24, TP-27, TP-28) should confirm three things: the status number, that the content type says JSON, and that the body has an `error` message. One small helper in the test file, shared with #109, can check all three in one line. After the TP-27 fix, the only known non-JSON answer left is the web-page 404 for an unknown path (section 3).

## 6. Order of work

1. **Write the tests for behavior that already works** (TP-19 to TP-24, TP-29). Each should pass the first time. If one fails, that is a defect: fix it in the same pull request if it is small, or open an issue.
2. **Write the TP-27 test** and watch it fail with 500. **Make the fix** in the error handler and watch it pass.
3. **Write the TP-28 tests** (empty object, no body, a list, only an unknown field) and watch them fail with 200. **Make the fix** in the PATCH route and watch them pass.
4. **Update the main test plan.** In `TEST_PLAN_SERVER_API.md`: change TP-28 from "decide" to the agreed answer, update TP-27's description (since #121 the answer is already JSON, but a 500), and mark TP-19 to TP-29 as existing (**E**) with an owner.
5. **Run every check** from the repo root: `npm test`, `npm run test:server`, `npm run typecheck`, `npm run lint`.
6. **Open a pull request** from the template, saying it closes #110.

## 7. How this fits with the other cards

- **#109 (Test plan 2 of 4)** changes the same test file and the same `app.ts`. Do the two on one branch, or merge #109 first, to avoid conflicts.
- **#111 (the team code review)** waits for #109 and #110 so the code under review is stable. The sprint ends Friday 11/13.
