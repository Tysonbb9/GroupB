# Test plan 2 of 4: the read endpoints (TP-08 to TP-17)

Issue: [#109](https://github.com/Tysonbb9/GroupB/issues/109). Part of the server API test plan, [TEST_PLAN_SERVER_API.md](TEST_PLAN_SERVER_API.md).
Written by Colin Redder, 11/10, against `main` at `2ec627d`.

## In plain words

*A short, non-technical summary. The detail starts further down.*

**What this is.** A plan for checking the two ways the app asks the server for tasks: "give me the tasks that match these filters" (`GET /tasks`) and "give me this one task" (`GET /tasks/:id`). Ten checks, numbered TP-08 to TP-17 in the main test plan.

**What we already know.** We tried each request against the server on 11/8 and 11/10. Eight of the ten already behave the way the team agreed, so their checks only need writing down as tests. Two do not:
- Asking for week 99, a week that does not exist, quietly returns an empty list. The team agreed it should say the request is wrong.
- Asking for a week with no value (`?week=`) also returns an empty list, because an empty value is read as week 0. It should say the request is wrong too.

**What changes in the code.** One small check in `GET /tasks`: a week has to be a whole number from 1 to 15, the same rule the database and `POST /tasks` already use.

**How long.** About 2 hours: an hour for the eight tests that already pass, an hour for the two that need the fix.

**Done when.** All ten checks are automated tests that pass in CI, none is still a placeholder, and the main test plan marks them as existing.

---

## 1. Where things stand

| | |
| --- | --- |
| Test file | `server/src/__tests__/taskts.test.ts` |
| Code under test | `server/src/app.ts`, `GET /tasks` (from line 79) and `GET /tasks/:id` (from line 64) |
| Placeholders today | 7 of the 10 rows are `it.todo` lines. TP-13, TP-14 and TP-15 have none. |
| Server tests today | 12 suites pass: 275 tests pass, 3 are skipped, 13 are placeholders. |
| Sample data | Every test starts from fresh sample data, because the file already resets it before each test. |

If the tests will not start and complain that `@supabase/supabase-js` is missing, the installed packages are older than the data layer. Run `npm ci` in `server/` once.

## 2. The ten checks

"Today" is what the server did when we sent the request on 11/10, using the sample data with no database.

| Row | What we ask | What should happen | Today | Work |
| --- | --- | --- | --- | --- |
| TP-08 | Tasks due in week 7 | 200, and every task is due in week 7 (there are 4) | correct | write the test |
| TP-09 | Tasks that are done | 200, and only finished tasks (there are 2) | correct | write the test |
| TP-10 | CS 262 tasks, due week 4, not done | only task `262-3` | correct | write the test |
| TP-11 | Week "abc" | 400 with a JSON error | correct | write the test |
| TP-12 | Done "maybe" | 400 with a JSON error | correct | write the test |
| TP-13 | A course that does not exist | 200 and an empty list (agreed) | correct | write the test |
| TP-14 | Week 99 | 400 with a JSON error (agreed) | **200 and an empty list** | test, then fix |
| TP-15 | Week with no value | 400, the same as a value that is not a number (agreed) | **200 and an empty list** | test, then fix |
| TP-16 | Task `262-2` | 200, and its title is "Vision statement" | correct | write the test |
| TP-17 | A task id that does not exist | 404 with a JSON error | correct | write the test |

Every error check should also confirm the answer really is JSON (the content type says JSON, and the body has an `error` message), not just that the status number is right. One small helper in the test file can do that for every row.

## 3. Cases the ten rows miss

We tried these too. They are not rows in the plan, but they belong next to TP-14 and TP-15 because the same fix covers them.

| What we ask | Today | Should be |
| --- | --- | --- |
| Week that is only a space | 200 and an empty list | 400. The fix should trim the value before checking it. |
| Week 0 | 200 and an empty list | 400, covered by the 1 to 15 rule |
| Week 16 | 200 and an empty list | 400, covered by the 1 to 15 rule |
| Week "7.0" | 200 and the 4 week-7 tasks | Fine as it is. Worth a test so a later change does not break it by accident. |
| Week given twice (`?week=7&week=8`) | 400 | Already right |

## 4. The fix

In `GET /tasks`, the week check accepts any whole number today. It should refuse a week that is missing a value, is blank once spaces are removed, is not a whole number, or is outside 1 to 15. The error message should match the one `POST /tasks` already uses: "week must be a whole number from 1 to 15". No test or other code depends on the current message, so changing it breaks nothing.

## 5. Order of work

1. **Write the eight tests for behavior that already works** (TP-08 to TP-13, TP-16, TP-17). Each should pass the first time. If one fails, that is a defect: fix it in the same pull request if it is small, or open an issue.
2. **Write the TP-14 and TP-15 tests**, plus the extra cases in section 3, and watch them fail.
3. **Make the fix** in `GET /tasks`, and watch every test pass, including the existing TP-11 test.
4. **Update the main test plan.** In `TEST_PLAN_SERVER_API.md`, rewrite TP-13 to TP-15 to the agreed answers (they still say "decide"), and mark TP-08 to TP-17 as existing (**E**) with an owner.
5. **Run every check** from the repo root: `npm test`, `npm run test:server`, `npm run typecheck`, `npm run lint`.
6. **Open a pull request** from the template, saying it closes #109.

## 6. How this fits with the other cards

- **#110 (Test plan 3 of 4)** changes the same test file and the same `app.ts`. Do the two on one branch, or merge this one first, to avoid conflicts.
- **#111 (the team code review)** waits for #109 and #110 so the code under review is stable. The sprint ends Friday 11/13.
