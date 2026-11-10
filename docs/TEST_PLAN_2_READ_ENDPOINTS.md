# Test plan 2 of 4: asking the server for tasks (TP-08 to TP-17)

Issue: [#109](https://github.com/Tysonbb9/GroupB/issues/109). Part of the server API test plan, [TEST_PLAN_SERVER_API.md](TEST_PLAN_SERVER_API.md).
Written 11/10 against `main` at `2ec627d`.

## The short version

This plan covers the two ways the app asks the server for tasks:

- **"Give me the tasks that match these filters"**, like "everything due in week 7" or "only the ones I've finished". (`GET /tasks`)
- **"Give me this one task."** (`GET /tasks/:id`)

There are ten checks, TP-08 to TP-17 in the main test plan. I tried every one against the server. Eight already work the way the team agreed, so they just need to be written down as automated tests. Two don't:

- **Asking for week 99** quietly gives back an empty list. There is no week 99 (the semester is weeks 1 to 15), so the server should say the request is wrong.
- **Asking for a week but leaving it blank** (`?week=`) also gives back an empty list, because the server treats blank as week 0. It should say the request is wrong too.

Both get fixed by one small check in the server: a week has to be a whole number from 1 to 15. That's the same rule the database and the "add a task" route already use.

**Time:** about 2 hours. An hour for the eight tests that already pass, an hour for the two that need the fix.

**Done when:** all ten checks are automated tests that pass on GitHub, none is still a placeholder, and the main test plan marks them as done.

---

## If you're new to this part of the app

You don't need to know the server code to follow this plan. Here's what the terms mean.

**The server and the app.** The app on your phone doesn't keep the tasks itself. It asks the server for them, a bit like ordering at a counter. Each kind of request has an address, called an **endpoint**. This plan tests two of them.

**GET.** A request that only *reads* data and never changes it. Both endpoints here are GETs. (Plan 3 covers PATCH, which *changes* a task.)

**Filters go after a `?`.** You narrow down the list by adding filters to the address:

```
/tasks                        every task
/tasks?week=7                 only tasks due in week 7
/tasks?done=true              only finished tasks
/tasks?courseId=cs262&week=4  CS 262 tasks due in week 4
```

**The server's answer starts with a status number.** These are the ones that matter here:

| Number | Means |
| --- | --- |
| **200** | OK, here's what you asked for |
| **400** | Your request doesn't make sense (like "week abc") |
| **404** | That thing doesn't exist (like a task id nobody has) |

**JSON** is the plain-text format the server answers in. When something goes wrong, the answer should still be JSON, with an `error` message the app can show, not a web page.

**Tests and placeholders.** Our tests live in `server/src/__tests__/taskts.test.ts`. Some rows are already written as placeholders (`it.todo`), which show up as "todo" when tests run. They're reminders, not real checks. This plan turns them into real tests.

**Sample data.** When the server runs without a database, it uses built-in sample data: 5 courses and 36 tasks. Every test starts from a fresh copy of it, so tests can't mess each other up.

---

## Where things stand

| | |
| --- | --- |
| Test file | `server/src/__tests__/taskts.test.ts` |
| Code being tested | `server/src/app.ts`: `GET /tasks` (from line 79) and `GET /tasks/:id` (from line 64) |
| Placeholders today | 7 of the 10 rows are `it.todo` lines. TP-13, TP-14 and TP-15 don't have one yet. |
| Server tests today | 275 pass, 3 skipped, 13 placeholders |

If the tests won't start and complain that `@supabase/supabase-js` is missing, your installed packages are out of date. Run `npm ci` in `server/` once.

## The ten checks

"Today" is what the server actually answered when I tried each request on 11/10.

| Row | What we ask for | What should happen | Today | Work |
| --- | --- | --- | --- | --- |
| TP-08 | Tasks due in week 7 | 200, and every task is due in week 7 (there are 4) | works | write the test |
| TP-09 | Finished tasks | 200, and only finished ones (there are 2) | works | write the test |
| TP-10 | CS 262, week 4, not finished | only task `262-3` | works | write the test |
| TP-11 | Week "abc" | 400, with a JSON error | works | write the test |
| TP-12 | Finished "maybe" | 400, with a JSON error | works | write the test |
| TP-13 | A course that doesn't exist | 200 and an empty list (agreed on the card) | works | write the test |
| TP-14 | Week 99 | 400, with a JSON error (agreed) | **200 and an empty list** | test, then fix |
| TP-15 | Week left blank | 400, same as "abc" (agreed) | **200 and an empty list** | test, then fix |
| TP-16 | Task `262-2` | 200, and its title is "Vision statement" | works | write the test |
| TP-17 | A task id that doesn't exist | 404, with a JSON error | works | write the test |

**Why TP-13 is fine but TP-14 isn't:** a course that doesn't exist yet could still be a real course (the list is just empty for now). Week 99 can never exist, so an empty list hides a mistake.

**One tip for writing these:** every error check should confirm the answer really is JSON with an `error` message, not just that the number is right. One small helper in the test file can do that for every row, so each check stays one line.

## Extra cases the ten rows miss

I tried these too. They aren't rows in the plan, but the same fix covers them, so test them alongside TP-14 and TP-15.

| What we ask for | Today | Should be |
| --- | --- | --- |
| Week that's just a space | 200 and an empty list | 400. The fix should trim spaces before checking. |
| Week 0 | 200 and an empty list | 400 (outside 1 to 15) |
| Week 16 | 200 and an empty list | 400 (outside 1 to 15) |
| Week "7.0" | 200 and the 4 week-7 tasks | Fine as is. Worth a test so nobody breaks it by accident. |
| Week given twice (`?week=7&week=8`) | 400 | Already right |

## The fix

Right now `GET /tasks` accepts any whole number as a week, including 0, 99, and blank (which it reads as 0). It should turn away a week that is:

- blank, or blank once spaces are trimmed,
- not a whole number,
- or outside 1 to 15.

The error message should match the one the "add a task" route already uses: **"week must be a whole number from 1 to 15"**. Nothing else depends on the current message, so changing it breaks nothing.

## Order of work

1. **Write the eight tests for things that already work** (TP-08 to TP-13, TP-16, TP-17). Each should pass the first time. If one fails, we've found a bug: fix it in the same pull request if it's small, or open an issue.
2. **Write the TP-14 and TP-15 tests**, plus the extra cases above, and watch them fail. Seeing them fail first proves the tests actually catch the problem.
3. **Make the fix** in `GET /tasks`. Then watch every test pass, including the existing TP-11 test.
4. **Update the main test plan.** In `TEST_PLAN_SERVER_API.md`, change TP-13 to TP-15 from "decide" to the agreed answers, and mark TP-08 to TP-17 as existing (**E**) with an owner.
5. **Run every check** from the repo root: `npm test`, `npm run test:server`, `npm run typecheck`, `npm run lint`.
6. **Open a pull request** using the template, saying it closes #109.

## How this fits with the other cards

- **#110 (test plan 3)** changes the same test file and the same `app.ts`. To avoid merge conflicts, do the two on one branch, or merge this one first.
- **#111 (the team code review)** waits for #109 and #110, so the code being reviewed isn't still changing. The sprint ends Friday 11/13.
