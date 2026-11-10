# Test plan 3 of 4: changing a task (TP-19 to TP-29)

Issue: [#110](https://github.com/Tysonbb9/GroupB/issues/110). Part of the server API test plan, [TEST_PLAN_SERVER_API.md](TEST_PLAN_SERVER_API.md).
Written 11/10 against `main` at `2ec627d`.

## The short version

This plan covers how the app changes a task: ticking it done, or setting or clearing how many hours it should take (`PATCH /tasks/:id`).

There are eleven checks, TP-19 to TP-29 in the main test plan. Two of them (TP-25 and TP-26) were already finished in #118, so nine are left. I tried every one against the server. Seven work the way the team agreed and just need writing down as tests. Two don't:

- **A garbled request** (broken JSON) gets "Internal server error", as if the server itself crashed. It's really the sender's mistake, so the server should say "bad request".
- **A request that changes nothing** (`{}`) is accepted with "OK". The team agreed it should say there's nothing to update.

Both get fixed by two small additions in `server/src/app.ts`.

**Earlier blocker, now gone:** the card said to wait for the database work (PR #121) before making the fixes. #121 is merged, so everything can start now.

**Time:** about 2 to 3 hours.

**Done when:** all eleven checks are automated tests that pass on GitHub, the broken-JSON problem is fixed, every error from this route is JSON, and the main test plan marks the rows as done.

---

## If you're new to this part of the app

You don't need to know the server code to follow this plan. Here's what the terms mean.

**The server and the app.** The app doesn't keep tasks itself; it asks the server, a bit like ordering at a counter. Each kind of request has an address, called an **endpoint**.

**PATCH** is a request that *changes part of* something. Here it changes one task. The app sends only the fields it wants changed, as a small piece of **JSON** (a plain-text format):

```
PATCH /tasks/262-2   { "done": true }               tick task 262-2 done
PATCH /tasks/262-2   { "estimatedHours": 4 }        say it'll take 4 hours
PATCH /tasks/262-2   { "estimatedHours": null }     clear the estimate
```

The server only knows two fields: `done` (true or false) and `estimatedHours` (a number from just above 0 up to 100, or `null` for "no estimate").

**The server's answer starts with a status number:**

| Number | Means |
| --- | --- |
| **200** | OK, done |
| **400** | Your request doesn't make sense (like done = "yes") |
| **404** | That task doesn't exist |
| **500** | The server itself broke. This should only happen for real bugs, never because someone sent something odd. |

When something goes wrong, the answer should still be JSON, with an `error` message the app can show.

**"All or nothing."** If a request has one good field and one bad field, the server should refuse the whole thing and change nothing. Half-applying a request would leave a task in a state nobody asked for.

**Tests and placeholders.** Our tests live in `server/src/__tests__/taskts.test.ts`. Some rows are already written as placeholders (`it.todo`), which show up as "todo" when tests run. They're reminders, not real checks. This plan turns them into real tests.

**Sample data.** Without a database, the server uses built-in sample data. Every test starts from a fresh copy, so tests can't mess each other up. The task used below, `262-2`, starts **not done** with an estimate of **2 hours**.

---

## Where things stand

| | |
| --- | --- |
| Test file | `server/src/__tests__/taskts.test.ts`, the `PATCH /tasks/:id` group |
| Code being tested | `server/src/app.ts`: the PATCH route (from line 117) and the shared error handler (from line 263) |
| Placeholders today | TP-19 to TP-24 are `it.todo` lines. TP-27, TP-28 and TP-29 don't have one yet. |
| Example to copy | TP-18 (tick a task done) already exists. It makes the change, then asks for the task again to prove the change really stuck. |
| Server tests today | 275 pass, 3 skipped, 13 placeholders |

## The eleven checks

"Today" is what the server actually answered when I tried each request on 11/10.

| Row | What we send | What should happen | Today | Work |
| --- | --- | --- | --- | --- |
| TP-19 | Estimate 4 | 200, and asking again shows 4 | works | write the test |
| TP-20 | Clear the estimate (`null`) | 200, and asking again shows no estimate | works | write the test |
| TP-21 | Done = "yes" instead of true/false | 400, with a JSON error | works | write the test |
| TP-22 | A negative estimate | 400, with a JSON error | works | write the test |
| TP-23 | Done = true, but a negative estimate | 400, and nothing changed (still not done, still 2 hours) | works | write the test |
| TP-24 | Any change to a task that doesn't exist | 404, with a JSON error | works | write the test |
| TP-25 | Estimate 0 | 400 | done in #118 | nothing |
| TP-26 | Estimate over 100 | 400 | done in #118 | nothing |
| TP-27 | Broken JSON, like `{"done":` | 400, with a JSON error | **500 "Internal server error"** | test, then fix |
| TP-28 | An empty request, `{}` | 400, "nothing to update" (agreed on the card) | **200, task unchanged** | test, then fix |
| TP-29 | Done = true, plus a field the server doesn't know (`colour`) | the unknown field is ignored, and the task is ticked done | works | write the test |

**A trap for TP-27:** the test has to send the broken text exactly as it is. If you pass it as a JavaScript object, the test tool turns it into valid JSON, and you've tested nothing.

**One tip for all the error checks:** confirm the answer really is JSON with an `error` message, not just that the number is right. One small helper in the test file (shared with #109) can do that, so each check stays one line.

## Extra cases the eleven rows miss

I tried these too. Most are covered by the TP-28 fix, so test them alongside it.

| What we send | Today | Should be |
| --- | --- | --- |
| No request body at all | 200, unchanged | 400, same as TP-28 |
| A list (`[]`) instead of `{...}` | 200, unchanged | 400, same as TP-28 |
| Only a field the server doesn't know | 200, unchanged | 400. Unknown fields don't count, so this is also "nothing to update". |
| Broken JSON | also prints a full error trace in the server's log | no trace. Broken input is the sender's mistake, not a server failure. |
| A change to an address that doesn't exist (`PATCH /nope`) | 404, but as a web page, not JSON | Outside these rows. Raise it with the team, and open an issue if they agree. |

## The fixes

**Broken JSON (TP-27).** Before our code even sees a request, Express (the library the server is built on) tries to read the JSON. When it can't, it flags the problem as `entity.parse.failed` with status 400. But our shared error handler only checks for two kinds of problem ("request too large" and "database unavailable"), so this one falls through to the catch-all 500.

The fix: one more case in that handler, next to the "too large" case and before the line that logs errors. It answers 400 with a message like "The request body is not valid JSON".

**Nothing to update (TP-28).** The PATCH route checks each field it knows (`done` and `estimatedHours`), but never checks that at least one was actually sent.

The fix: one check after the field checks. When neither field is present, answer 400 with "Nothing to update: send done or estimatedHours". The "task doesn't exist" check stays first, so a missing task is still reported as missing.

## Making sure every error is JSON

The card asks that "the error format is always JSON". Every error check in this plan (TP-21 to TP-24, TP-27, TP-28) should confirm three things:

1. the status number,
2. that the answer says it's JSON,
3. and that it has an `error` message.

After the TP-27 fix, the only known non-JSON answer left is the web-page 404 for an address that doesn't exist (see the extra cases).

## Order of work

1. **Write the tests for things that already work** (TP-19 to TP-24, TP-29). Each should pass the first time. If one fails, we've found a bug: fix it in the same pull request if it's small, or open an issue.
2. **Write the TP-27 test** and watch it fail with 500. **Make the fix** in the error handler and watch it pass. Seeing it fail first proves the test actually catches the problem.
3. **Write the TP-28 tests** (empty object, no body, a list, only an unknown field) and watch them fail with 200. **Make the fix** in the PATCH route and watch them pass.
4. **Update the main test plan.** In `TEST_PLAN_SERVER_API.md`:
   - change TP-28 from "decide" to the agreed answer;
   - update TP-27's description (since #121 the answer is already JSON, but it's a 500);
   - mark TP-19 to TP-29 as existing (**E**) with an owner.
5. **Run every check** from the repo root: `npm test`, `npm run test:server`, `npm run typecheck`, `npm run lint`.
6. **Open a pull request** using the template, saying it closes #110.

## How this fits with the other cards

- **#109 (test plan 2)** changes the same test file and the same `app.ts`. To avoid merge conflicts, do the two on one branch, or merge #109 first.
- **#111 (the team code review)** waits for #109 and #110, so the code being reviewed isn't still changing. The sprint ends Friday 11/13.
