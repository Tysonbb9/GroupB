# Test plan: the server API

## In plain words

*A short, non-technical summary for everyone. The detail starts further down.*

**What this is.** A plan for checking that the part of our app that stores and hands out information (the "server") does what it should. It is a checklist: the questions we ask the server, and the answers we expect.

**Why we are doing it.** Our course asks for two things this sprint: a written test plan, and a code review where the whole team reads the same piece of code together. We pick one piece of code, so both happen on it.

**What gets checked.** The app asks the server things like "give me this week's tasks" or "mark this task done." We check that the server answers correctly, refuses a bad request with a clear message, and keeps the information right. When the new database (Supabase) arrives, we check that too.

**What we already know is wrong.** Three small problems, found by trying the server:
- It accepts 0 hours or 5,000 hours for a task, but the app only allows more than 0 and up to 100.
- When a request is garbled, it replies with a web page instead of a clear message.
- A wrong filter, such as a week that does not exist, quietly gives an empty list instead of saying so.

**What each person does.** Take a few rows from the table in section 4 (each is about 15 to 45 minutes). Write the check first, watch it fail, fix the code so it passes, and send it in as a pull request. Everyone reads the code before the review, and the whole team meets once to review it together.

**How long.** About 4 to 6 hours per person, spread over the next two weeks. The review session is proposed for Thursday 11/5, and everything is finished by Thursday 11/12.

**What the team decides on Tuesday.**
1. Is the server the right piece of code to focus on?
2. What should the server do in four unclear cases (marked **D** in the table)?
3. Who takes which rows?
4. When is the review session?

**Words used below.**
- *Test:* a small program that checks one thing.
- *Endpoint (or route):* one kind of request the server answers, such as "get the tasks".
- *Data layer:* the part of the server that stores and retrieves information.
- *Code review:* reading the code together to find problems and agree on fixes.

---
**Status:** first draft for the team to review at the 10/27 meeting. Written by the PM. Nothing here is decided until the team agrees.

**Why this exists:** the Project Implementation deliverable is graded on **VV7** (implement a test plan for a medium-size code segment) and **VV10** (a team code review of a medium-size code segment). We already have many tests, but no written plan that says what we test, why, and how each test traces back to a requirement or a risk. This plan is for one segment, and the same segment gets the team code review.

## 1. The segment under test

The server in `server/`:

| Part | Files |
|---|---|
| Routes, JSON and CORS handling, and the review endpoints | `server/src/app.ts` |
| The data store | `server/src/data/db.ts`, `server/src/data/semester.ts` |
| The syllabus PDF endpoint | `server/src/syllabus/routes.ts`, `pdf-text.ts`, `read-pdf.worker.mjs` |
| Start-up | `server/src/index.ts` |
| **The database layer arriving this sprint (Supabase)** | not written yet |

**Why this segment:** it is medium-size, it is the part of the system whose behavior the client depends on, it has 13 placeholder tests (`it.todo`), and it has real gaps (section 4). The database layer is being added this sprint, so a plan now shapes it instead of describing it afterwards.

**Out of scope:** the client screens, the internals of the PDF library beyond the endpoint's behavior (already covered by `pdf-text.test.ts` and `pdf-extract.test.ts`), performance and load, and authentication (not built).

## 2. Requirements and risks this plan traces to

| Source | What the API has to do |
|---|---|
| US-02 / FR-02 | Send the weekly capacity (and the current week) in `GET /semester` |
| US-06 to US-09 | List tasks (with filters), and mark a task done through `PATCH /tasks/:id` |
| US-12, US-13 / FR-11, FR-12 | Set or clear a task's estimated hours through `PATCH` |
| US-24, US-29 / FR-23, FR-27 | `POST /syllabus/text` turns a PDF into text, with clear errors |
| US-32 / FR-30 | A new endpoint to change the weekly capacity (not built yet) |
| NFR-02 | The browser version can read the server (CORS) |

| Risk | Why it matters |
|---|---|
| **R1** Client and server disagree on valid estimates | The client accepts more than 0 and at most 100 hours, the server accepts anything 0 or more. |
| **R2** An error comes back as a web page, not JSON | The client reads `{ "error": "message" }`. |
| **R3** A wrong filter returns an empty list instead of an error | The student sees nothing and cannot tell why. |
| **R4** A bad request half-changes a task | Data ends up inconsistent. |
| **R5** The new database behaves differently from the in-memory store | Unknown ids, missing values, errors and persistence can change. |
| **R6** Secret keys end up in the repository or in a test | A security and course-policy problem. |
| **R7** The database being unreachable | The app must fail with a clear message, not a crash or a stack trace. |

## 3. Approach

- **Level:** API tests that call the real Express app with `supertest`, run by Jest. This is the style already used in `server/src/__tests__/`, and it runs fast with no network.
- **Data:** every test starts from the same known state through `resetDb()`: 5 courses, 36 tasks, weekly capacity 15, current week 3.
- **Database layer:** write the cases once, and run them against the in-memory store now. When the Supabase layer exists, run the same cases against it, through a test project or a mock, so the two behave the same (R5). Unit tests never need real keys (R6).
- **Automation:** the tests run on every pull request through the CI workflow.
- **Test first:** each new case is written failing first, then the code is fixed or written to pass it.

## 4. Test cases

**Status key:** **E** = exists already and passes. **T** = a placeholder (`it.todo`) to implement. **N** = new case to write. **D** = needs a team decision on the intended behavior before the test can be written.

| ID | Area | Case | Expected | Traces to | Status | Owner |
|---|---|---|---|---|---|---|
| TP-01 | GET /semester | Returns label, current week, capacity, 5 courses and 36 tasks | 200 and that data | US-02 | E | |
| TP-02 | GET /semester | Capacity is a positive number, current week is 1 to 15 | as stated | US-02 | E | |
| TP-03 | GET /courses | Returns all five courses | 200, 5 items | | E | |
| TP-04 | GET /courses/:id | Existing id | 200 and the course | | E | |
| TP-05 | GET /courses/:id | Unknown id | 404 with a JSON error | | E | |
| TP-06 | GET /tasks | No filters | all 36 tasks | US-06 | E | |
| TP-07 | GET /tasks | `?courseId=cs262` | only that course's tasks | US-06 | E | |
| TP-08 | GET /tasks | `?week=7` | every returned task has `dueWeek` 7 | US-06 | T | |
| TP-09 | GET /tasks | `?done=true` | only completed tasks | US-09 | T | |
| TP-10 | GET /tasks | `?courseId=cs262&week=4&done=false` | only the task that matches all three | US-06 | T | |
| TP-11 | GET /tasks | `?week=abc` | 400 with a JSON error | R3 | T | |
| TP-12 | GET /tasks | `?done=maybe` | 400 with a JSON error | R3 | T | |
| TP-13 | GET /tasks | `?courseId=nope` (no such course) | today 200 and an empty list. Keep that, or 404? | R3 | D | |
| TP-14 | GET /tasks | `?week=99` (outside 1 to 15) | today 200 and an empty list. Keep that, or 400? | R3 | D | |
| TP-15 | GET /tasks | `?week=` (empty value) | today 200 and an empty list, because empty counts as week 0. It should be a 400. | R3 | D | |
| TP-16 | GET /tasks/:id | Existing id (`262-2` is "Vision statement") | 200 and the task | | T | |
| TP-17 | GET /tasks/:id | Unknown id | 404 with a JSON error | | T | |
| TP-18 | PATCH /tasks/:id | Mark a task done | 200, and a later GET shows it done | US-08 | E | |
| TP-19 | PATCH /tasks/:id | Set `estimatedHours` to 4 | 200, and the value sticks | US-12 | T | |
| TP-20 | PATCH /tasks/:id | Clear it with `null` | 200, now `null` | US-13 | T | |
| TP-21 | PATCH /tasks/:id | `done` is not a boolean (`"yes"`) | 400 with a JSON error | R4 | T | |
| TP-22 | PATCH /tasks/:id | `estimatedHours` is negative | 400 with a JSON error | R1 | T | |
| TP-23 | PATCH /tasks/:id | One valid and one invalid field together | 400, and nothing changed | R4 | T | |
| TP-24 | PATCH /tasks/:id | Unknown id | 404 with a JSON error | | T | |
| TP-25 | PATCH /tasks/:id | `estimatedHours` is 0 | 400, to match the client (more than 0) | R1 | E | ColinRedder |
| TP-26 | PATCH /tasks/:id | `estimatedHours` is over 100 | 400, to match the client (at most 100) | R1 | E | ColinRedder |
| TP-27 | PATCH /tasks/:id | A malformed JSON body | 400 with a **JSON** error, not a web page | R2 | N | |
| TP-28 | PATCH /tasks/:id | An empty body `{}` | change nothing: 200 unchanged, or 400? | R4 | D | |
| TP-29 | PATCH /tasks/:id | An unknown extra field | ignored, nothing else changes | R4 | N | |
| TP-30 | CORS | A GET from another origin | `Access-Control-Allow-Origin` is sent | NFR-02 | E | |
| TP-31 | CORS | The preflight before a PATCH | 204 with the right headers | NFR-02 | E | |
| TP-32 | POST /syllabus/text | A real PDF | 200 with its text, and the page and line counts | US-29 | E | |
| TP-33 | POST /syllabus/text | Not a PDF, no content type, empty body, over 10 MB | 415, 415, 400 and 413 with the shared JSON error shape | US-29 | E | |
| TP-34 | POST /syllabus/text | A scanned, locked or damaged PDF | 422 with a message saying what to do | US-29 | E | |
| TP-35 | POST /syllabus/text | Something unexpected breaks | 500 that does not blame the student | US-29 | E | |
| TP-37 | POST /courses/:id/reviews | A valid review (title, hours over 0 and up to 100, optional comment) | 201, and it is saved | US-22 | E | |
| TP-38 | POST /courses/:id/reviews | A bad body (hours 0 or over 100, missing title), or an unknown course | 400, or 404, with a JSON error | US-22, R4 | E | |
| TP-39 | GET /courses/:id/reviews | Reviews of one course, and an unknown course | 200 and the list, or 404 | US-22 | E | |
| TP-36 | PATCH /semester (new) | Set the weekly capacity | 200, the value sticks, bad values get a 400 | US-32 | N | |
| TP-40 | Database layer | `GET /semester` from the database has the same shape as the in-memory store | same fields and types | R5 | N | |
| TP-41 | Database layer | A `PATCH` persists across requests and after a restart | the change is still there | R5 | N | |
| TP-42 | Database layer | An unknown id | 404, not 500 | R5 | N | |
| TP-43 | Database layer | The database cannot be reached | a clear JSON error, no stack trace | R7 | N | |
| TP-44 | Database layer | Keys come from environment variables, and no key is in the repository | no secret in any tracked file | R6 | N | |

The rows marked **E** already exist (see `server/src/__tests__/`), so the plan also shows what is already covered. The 13 placeholders are TP-08 to TP-12, TP-16, TP-17, and TP-19 to TP-24.

## 5. Defects this plan is expected to confirm

Checked against the running server on 10/25:

- **R1:** `PATCH /tasks/262-2` with `{"estimatedHours":0}` and with `{"estimatedHours":5000}` both answer 200. The client only allows more than 0 and at most 100.
- **R2:** a `PATCH` with a malformed JSON body answers 400 with a content type of `text/html`, not JSON.
- **R3:** `GET /tasks?week=99`, `?week=` and `?courseId=nope` all answer 200 with an empty list.

Each one needs a decision on the intended behavior first (the **D** rows), then a failing test, then a fix.

## 6. Entry and exit criteria

- **Entry:** the team has chosen this segment, the seed data is stable, and the CI workflow is merged and running.
- **Exit:** every case is either an automated test that passes in CI or marked "decided not to test" with a reason, each defect found is fixed or logged as an issue, and the team code review is done and recorded (section 8).

## 7. Roles and schedule (a proposal)

| When | What | Who |
|---|---|---|
| Tue 10/27 | Review this draft, choose the segment, decide the D rows, take cases | the team |
| By Tue 11/3 | Implement the cases test first, with the database layer | owners of each row |
| By Thu 11/5 | Hold the team code review of the segment and its new tests | the whole team, chaired by the LE |
| By Tue 11/10 | Fix what the review found | the author of each piece |
| By Thu 11/12 | Finish this plan and the review record | PM and LE |

## 8. The team code review (VV10)

The review is a **team activity on the same segment**. It is not the same as approving pull requests. The segment is divided into **five sections**, and each reviewer accepts one section as a GitHub issue (Code review 1/5 to 5/5):

| Section | What it covers |
|---|---|
| 1 | The routes that read data (`GET`) |
| 2 | The routes that change data, the review endpoints, and request handling (CORS, JSON) |
| 3 | The syllabus PDF endpoint, its limits and error handling |
| 4 | Reading the PDF: the worker and rebuilding lines |
| 5 | The data layer, configuration and keys (including the new Supabase layer once merged) |

- **Rule:** a reviewer is never an author of the code in their section. Each issue lists who wrote it.
- **Before:** each reviewer reads their section and its tests, with the coding standard checklist (`docs/CodingStandard.md`).
- **Record:** each finding is a comment on the section's issue, with the file and line, a severity (must fix, should fix, nit), the finding and a suggestion.
- **Session:** one meeting of the whole team, where each reviewer presents their findings and the author responds. The chair (the LE) runs it, and the scribe notes who attended and what was decided.
- **After:** each finding is fixed in a PR or declined with a reason. The scribe then writes `docs/CODE_REVIEW_SERVER_API.md` from the five issues.
## 9. Questions for the team

1. Is the server API the right segment, or is the syllabus input pipeline better?
2. What should happen in each **D** case (TP-13, TP-14, TP-15, TP-28)?
3. For the database layer, do we run cases against a Supabase test project, or against a mock?
4. Where do the Supabase keys live (environment variables and a git-ignored file are the usual answer)?
5. Who takes which rows, and who chairs the review?

## 10. What a test looks like (worked examples)

All examples use the style already in `server/src/__tests__/`: `supertest` calls the real Express app, and `resetDb()` gives every test the same starting data.

**A placeholder becomes a real test (TP-08).** Today it is `it.todo('filters by week')`. Written out:

```ts
it('filters by week', async () => {
  const res = await request(app).get('/tasks?week=7');
  expect(res.status).toBe(200);
  expect(res.body.length).toBeGreaterThan(0);
  for (const task of res.body) {
    expect(task.dueWeek).toBe(7); // every task that came back is due in week 7
  }
});
```

**A new test that fails first, then drives a fix (TP-25, risk R1).** The client only accepts more than 0 and at most 100 hours, so the server should agree:

```ts
it('rejects an estimate of 0 hours, as the client does', async () => {
  const res = await request(app).patch('/tasks/262-2').send({ estimatedHours: 0 });
  expect(res.status).toBe(400);
  expect(res.body.error).toMatch(/estimatedHours/);
});
```

Run `npm run test:server` and watch it fail (today the server answers 200). Then change the check in `app.ts` from "0 or more" to "more than 0 and at most 100", run it again, and watch it pass. That red-then-green history is the test-first evidence (SC6).

**A defect found by the plan (TP-27, risk R2).** A malformed JSON body should get a JSON error, not a web page:

```ts
it('answers a malformed JSON body with a JSON error', async () => {
  const res = await request(app)
    .patch('/tasks/262-2')
    .set('Content-Type', 'application/json')
    .send('{"estimatedHours":');
  expect(res.status).toBe(400);
  expect(res.headers['content-type']).toMatch(/json/);
});
```

The fix is a small error handler placed after the routes in `app.ts`, which turns Express's parse error into `{ "error": "request body is not valid JSON" }`.

## 11. Testing the data layer

Today the routes read the in-memory `db` directly, so there is no separate "data layer" to test. The Supabase work introduces one: a small interface (a **store**) that the routes call, with two implementations, the in-memory one and the Supabase one.

```ts
interface Store {
  getSemester(): Promise<Semester>;
  getTask(id: string): Promise<Task | null>;
  updateTask(id: string, change: Partial<Task>): Promise<Task | null>;
  // ...courses, task lists with filters, reviews
}
```

Because Supabase calls are asynchronous, every route becomes `async`. That is the biggest change in the segment, and the reason it needs the most careful review.

One shared set of tests, the **contract**, runs against every implementation, so they must behave the same:

```ts
describe.each([['memory', makeMemoryStore], ['supabase', makeSupabaseStore]])('%s store', (_name, make) => {
  it('keeps an update', async () => {
    const store = await make();
    await store.updateTask('262-2', { done: true });
    expect((await store.getTask('262-2'))?.done).toBe(true);
  });
  it('answers null for an unknown id', async () => {
    const store = await make();
    expect(await store.getTask('nope')).toBeNull();
  });
});
```

The Supabase half only runs when the Supabase environment variables are set, so CI and the professor never need keys. The memory half always runs.

## 12. Who does what

The plan has about 45 rows, and each row is roughly 15 to 45 minutes of work. So a person with 8 to 10 rows has 4 to 6 hours. A proposal to react to:

| Role | Person (proposed) | What they do | Rows | Size |
|---|---|---|---|---|
| **Plan owner and review chair** | Tyson (LE) | Finalize this plan with the team, settle the open cases, chair the review session | the **D** rows | S |
| **Read endpoints** | to be assigned | Write TP-08 to TP-17: filters, combined filters, bad filters, and get by id | 10 | S to M |
| **Write endpoints** | to be assigned | Write TP-19 to TP-29, with the fixes for R1, R2 and R4: estimate limits, bad types, atomic updates, the JSON error handler | 11 | M |
| **New endpoints** | to be assigned | `PATCH /semester` (US-32) and `POST /tasks` (US-30), each test first | TP-36 and more | M to L |
| **Data layer** | Gabby (owns the server) | The store interface, the memory implementation, the Supabase implementation, and making the routes `async` | TP-40 to TP-44 | L |
| **Contract tests and CI** | to be assigned | The shared contract suite, skipped without keys, and a CI check that no key is in a tracked file | TP-40 to TP-44 | M |
| **Scribe** | PM or TJ | Notes who attended and the decisions, then writes the review record from the five section issues | the review document | S |
| **Reviewers** | all | Each person accepts one of the five review sections (not one they wrote), reviews it, and presents the findings | | S to M |

**What one person does, step by step (about 8 steps, once per batch of rows):**
1. Take rows and put your name in the Owner column of this plan.
2. Branch from `main`.
3. For each row, write the test first and run `npm run test:server` to see it fail (or confirm that an `E` row passes).
4. Make the smallest change that makes it pass. Some rows need no code change, only the test.
5. Run `npm test`, `npm run test:server`, `npm run typecheck` and `npm run lint`.
6. Open a PR with the template, `Closes #n`, and the plan rows you finished.
7. Change those rows in this plan from **T** or **N** to **E**, in the same PR.
8. The LE (or another reader) reviews it, and CI must be green.

## 13. The review session

The five review sections are separate issues (Code review 1/5 to 5/5), and an umbrella issue (Code review 0/5) tracks the session and the record. In the session of about 60 minutes, with everyone present:
1. Each reviewer presents the findings from their section in a few minutes, and the author of that section responds.
2. The chair keeps time and makes sure each finding ends in a decision: fix it, or decline it with a reason.
3. The scribe notes who attended and the decisions.
4. Afterwards each finding becomes a fix in a PR, or is declined with a reason, and the record states which.