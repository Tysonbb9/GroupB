# Crunch Week server


Express + TypeScript REST API for the Crunch Week app. The server supports
two data stores: an in-memory MemoryStore and a hosted Supabase (Postgres)
SupabaseStore.

By default, the server uses MemoryStore with a shared course catalog and an empty semester for each new student. `POST /semester/sample` explicitly copies the sample from `src/data/semester.ts` into that account. No Supabase account or credentials are required.
Changes made in memory are lost when the server restarts.

When both `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are configured,
the server uses SupabaseStore instead. Changes are saved in the hosted
database and persist across server restarts.

## Supabase

The team's database is a hosted Supabase (Postgres) project.

- **Project URL:** https://gyrruunfpwoexoncceel.supabase.co
- **Owner:** TJ French (tjf24)
- **Plan:** Free

The project URL is not a secret and is safe to keep in this file. **Never**
write a Supabase key (anon, service-role, or database password) into the
repository, an issue, a chat, or an email — keys are kept out of version
control and configured locally instead.

### Free-tier limits (checked 2026-10-28)

From the [Supabase pricing page](https://supabase.com/pricing#compare-plans):

- **Cost:** $0/month
- **Database size:** 500 MB per project (Shared CPU, 500 MB RAM)
- **API requests:** unlimited
- **Monthly active users:** 50,000
- **Egress:** 5 GB (plus 5 GB cached egress)
- **File storage:** 1 GB
- **Projects:** 2 active projects
- **Pausing:** a free project is **paused after 1 week of inactivity**
- **Backups:** not included on the Free plan
- **Support:** community support only

Because free projects pause after a week of inactivity, an unused project may
need to be unpaused from the Supabase dashboard before the app can reach it.

### Keys

The server needs two values to reach the database. `server/.env.example`
lists them with no values:

| Variable | What it is | Secret? |
|---|---|---|
| `SUPABASE_URL` | The project URL above | No |
| `SUPABASE_SECRET_KEY` | The secret key (`sb_secret_...`). It bypasses every access rule, so it lives **only on the server** | **Yes** |

To set them up, copy `server/.env.example` to `server/.env` and fill in the
values. `server/.env` is ignored by git, so it cannot be committed by accident.

**How teammates get the values:** each person opens the Supabase dashboard with
their own invitation (Project Settings > API Keys) and copies them. Keys are
never sent in chat or email, and never go in the client, in an `EXPO_PUBLIC_`
variable (those are visible inside the app), in a test, a screenshot or an
issue. If a key leaks, the owner rotates it in the dashboard.

Login (US-21) adds four more names to `server/.env`. All four can stay empty
while developing: accounts are then kept in memory and lost on restart, and
Better Auth signs sessions with a built-in development secret.

**In production, set `NODE_ENV=production` and all four.** The server then
refuses to start if any of them is missing or empty, instead of quietly
keeping accounts in memory or thinking it lives at `localhost`. Nothing sets
`NODE_ENV` today; whoever deploys the server sets it.

| Variable | What it is | Secret? |
|---|---|---|
| `DATABASE_URL` | Supabase's Postgres connection string (Dashboard > Connect), where accounts are saved. Separate from the secret key above | **Yes**, it holds the database password |
| `BETTER_AUTH_SECRET` | A long random string that signs the sessions. Required in production. Make one with `npx auth secret` | **Yes** |
| `BETTER_AUTH_URL` | The server's own address. Default `http://localhost:3000` | No |
| `CLIENT_ORIGIN` | Expo Web's address, the only web page allowed to call the server with cookies. Default `http://localhost:8081` | No |

`src/__tests__/no-secrets.test.ts` (TP-44) fails if a key-shaped string is in
any file git would commit, and checks that `server/.env` is ignored.

### Build the database from scratch

The tables follow `docs/DATABASE_DESIGN.md`. The SQL is in `db/`:

| File | What it does |
|---|---|
| `db/schema.sql` | Creates the tables (the four live tables, Better Auth's four login tables, `enrollments`, and the course tables for the AI screens), their rules, and turns on Row Level Security |
| `db/migration_127_users_enrollments.sql` | Adds the login tables and `enrollments` to a database that already has data. Leaves existing rows alone. |
| `db/migration_144_course_tables.sql` | Adds the course tables for the AI screens (`syllabi`, `grade_weights`, `course_policies`, `course_checkins`, `week_hours`) to a database that already has data. Run it after the #127 migration. Leaves existing rows alone. |
| `db/seed.sql` | Loads the shared calendar and catalog: 1 semester, 5 courses, no student tasks |
| `db/migration_course_catalog.sql` | Backfills normalized code identity with a unique index and adds search and atomic create-and-enroll functions. Run after migration_own_semester.sql. |
| `db/migration_own_semester.sql` | Adds student settings and task ownership, deletes only ownerless sample tasks and adds the transactional sample-copy function. Run after the existing migrations. |
| `db/reset.sql` | **Deletes every table and all data**, including saved reviews and accounts |

On an empty project:

1. In the Supabase dashboard, open **SQL Editor** and start a new query.
2. Paste all of `db/schema.sql` and press **Run**. It should say "Success. No rows returned".
3. Paste all of `db/seed.sql` and press **Run**. The last result should show
   `semester_rows 1`, `courses 5`, `tasks 0`, `reviews 0`.

To start over, run `db/reset.sql` first, then steps 2 and 3. Check with the
team before you do: it deletes every review students have saved.

Each file runs as one transaction, so if anything fails, nothing changes.

## Run it

```bash
cd server
npm install
npm run dev        # http://localhost:3000, restarts on save
```

### Run without Supabase (default)

No Supabase account, database, or API keys are required.

From the project root:

```bash
cd server
npm install
npm run dev
```

The server starts at `http://localhost:3000`.

If `server/.env` does not exist, the server automatically uses
`MemoryStore`, which starts each account empty. A sample is available through `POST /semester/sample`.

You can verify the sample data by opening
`http://localhost:3000/semester` in your browser.

Changes made to tasks and reviews are stored in memory and will
be lost when the server restarts.

If you already have a `server/.env` file containing both Supabase
credentials, temporarily move it out of the `server` directory
before starting the server to use MemoryStore.


### Run with Supabase

To use the hosted Supabase database instead of in-memory data:

1. Ask the project owner for access to the Supabase project.
2. Open the Supabase dashboard and go to Project Settings > API Keys.
3. From the `server/` directory, create your local environment file:

   ```bash
   cp .env.example .env
   ```

4. Open `.env` and configure both variables:

   ```dotenv
   SUPABASE_URL=your_project_url
   SUPABASE_SECRET_KEY=your_secret_key
   ```

5. Make sure the database tables and sample data have been created
   using `db/schema.sql` and `db/seed.sql`, as described above.
6. Start the server:

   ```bash
   npm install
   npm run dev
   ```

The server automatically loads `.env` and selects `SupabaseStore`
when both variables are present.

Open `http://localhost:3000/semester` to verify that the server
can retrieve the semester from Supabase.

Changes to tasks and reviews are saved in the database and
persist across server restarts.

If credentials are incorrect or the database is unavailable,
the server does not automatically fall back to MemoryStore.

## Test it

```bash
npm test           # Jest + Supertest, tests in src/__tests__/
npm run typecheck
```

## API

All responses are JSON. Errors look like `{ "error": "message" }`. The server
allows Expo Web's address (`CLIENT_ORIGIN`) to call it with cookies (CORS), so
the browser version of the client can use it. A phone does not check CORS.

### Login (US-21)

[Better Auth](https://better-auth.com) answers these routes itself (see
`src/auth.ts` and `docs/LOGIN_DESIGN.md`, the contract with the phone). Signing
up or in hands back a session cookie that lasts 30 days, pushed back each day
the app is used. Email and password only: no email check and no
forgot-password yet, since both need email.

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| POST | `/api/auth/sign-up/email` | `{ name, email, password }` | 200 `{ token, user }` and the cookie | 400 password under 8 characters, 422 email already used |
| POST | `/api/auth/sign-in/email` | `{ email, password }` | 200 and the cookie | 401 wrong email or password |
| POST | `/api/auth/sign-out` | `{}` | 200 `{ "success": true }`; the session ends | |
| GET | `/api/auth/get-session` | | 200 `{ session, user }`, or `null` when signed out | |

These routes' errors look like `{ "message", "code" }`; show `message` to the
student. A request that carries a cookie, or comes from a web page, must come
from a trusted address (the app, Expo Go or Expo Web), or the answer is 403.

**Every other route below needs a session.** Without a valid session cookie it
answers `401 { "error": "Sign in first" }`. Only `/api/auth/*` and the
browser's OPTIONS preflight are open. To try routes with curl, sign up once and
keep the cookie:

```bash
curl -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"name":"Ada","email":"ada@example.com","password":"long-enough-1"}' \
  http://localhost:3000/api/auth/sign-up/email
curl -b cookies.txt http://localhost:3000/semester
```

### Routes

| Method | Path | Description | Success | Errors |
|---|---|---|---|---|
| GET | `/catalog?q=TEXT` | Search shared codes and names, ranked exact code then code prefix then other matches; at most 10, each with enrolled | 200 | 400 for missing, blank or unusable q |
| POST | `/courses/:id/enroll` | Join a catalog course; joining again is unchanged | 200 with the course | 404 for an unknown catalog id |
| POST | `/courses` | Trim code and name, create a new course and enroll the caller | 201 with the course | 400 for invalid text; 409 with error and existing course for a duplicate code |
| GET | `/semester` | Shared calendar with this student's capacity, enrolled courses and tasks; new accounts are empty with capacity 15 | 200 | |
| POST | `/semester/sample` | Enroll in five sample courses, copy 36 tasks; use capacity 15 only when unset | 201 with the whole semester | 409 if any enrollment or task already exists |
| GET | `/courses` | All courses | 200 | |
| GET | `/courses/:id` | One course | 200 | 404 |
| GET | `/tasks` | All tasks. Filters: `?courseId=`, `?week=`, `?done=true\|false` | 200 | 400 bad `week` or `done` |
| GET | `/tasks/:id` | One task | 200 | 404 |
| PATCH | `/semester` | Set the weekly capacity: `{ weeklyCapacity }`, a whole number of hours from 1 to 80. Returns the whole semester | 200 | 400 bad body |
| PATCH | `/tasks/:id` | Update `done` and/or `estimatedHours` | 200 | 400 bad body, 404 |
| POST | `/syllabus/text` | A syllabus PDF in (`Content-Type: application/pdf`), its text out | 200 | 400 empty, 413 over 10 MB, 415 not a PDF, 422 no text / locked / damaged / over 50 pages |
| GET | `/ai/status` | `{ available }`: whether the server has an AI to read syllabi with | 200 | |
| POST | `/ai/syllabus` | Syllabus text in (`{ text }`), what the AI read out: `{ assignments, weights, policies, dropped }`, every field checked. Takes about 30 seconds | 200 | 400 no text, 413 over 30,000 characters, 502 the AI failed or gave an unusable answer, 503 no AI set up |
| POST | `/courses/:id/reviews` | Add a review: assignment `title`, `hours` (over 0, up to 100), optional `comment` | 201 | 400 bad body, 404 |
| GET | `/courses/:id/reviews` | Reviews of one course | 200 | 404 |
| POST | `/tasks` | Add reviewed syllabus assignments, all or nothing: `{ tasks: [{ courseId, title, dueWeek (1-15), estimatedHours (over 0, up to 100, or null) }] }` | 201 | 400 bad body |

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
curl -b cookies.txt -X POST -H 'Content-Type: application/pdf' --data-binary @syllabus.pdf http://localhost:3000/syllabus/text
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

### The AI that reads a syllabus (optional)

With three settings in `server/.env` the server can ask a language model to read a syllabus (issue #145). With any of them empty there is no AI, `GET /ai/status` answers `{ "available": false }`, and the app reads syllabi with its simple scanner as before.

```
AI_BASE_URL=https://localai.calvin.edu/api/v1
AI_API_KEY=<your own key>
AI_MODEL=nvidia-qwen3-6-35b-a3b-nvfp4
```

- **Calvin's local AI:** make your own key at https://localai.calvin.edu (Settings > Account > API keys, then press Save). The key is a secret: only in `server/.env`, which git ignores. Never put it in the client, a test, an issue or a chat.
- **Any OpenAI-style service works.** Change the three settings, not the code.
- **It is slow:** one syllabus takes about 30 seconds, so the app shows a waiting message.
- **The model never has the last word.** Every field of its answer is checked, and a week outside 1 to 15 or hours outside 0 to 100 are left blank for the student to fill in.
- **Tests use a fake model.** No test calls a real service or needs a key.

## Files

- `src/index.ts`: starts the server
- `src/app.ts`: all routes, apart from the syllabus router it mounts, and the session check in front of them
- `src/auth.ts`: login with Better Auth (US-21): where accounts are kept, how long sessions last, which addresses may sign in
- `src/testing/session.ts`: `signedIn()`, which signs up a test student so the route tests can call routes that need a session
- `src/syllabus/routes.ts`: `POST /syllabus/text`
- `src/syllabus/pdf-text.ts`: checks the upload and rebuilds lines from the PDF's text
- `src/syllabus/read-pdf.worker.mjs`: opens the PDF with pdf.js, in a worker thread. Plain JavaScript because pdf.js is an ES module, which the CommonJS server and Jest cannot load directly
- `src/ai/model.ts`: `createModelClient()`, the one place the server calls a language model (OpenAI-style chat completions, from `AI_BASE_URL`, `AI_API_KEY` and `AI_MODEL`)
- `src/ai/syllabus-reading.ts`: the prompt for reading a syllabus, and `parseReading`, which checks every field of the answer and drops what does not fit
- `src/ai/routes.ts`: `GET /ai/status` and `POST /ai/syllabus`
- `src/testing/pdfs.ts`: builds real PDFs for the tests; `src/testing/fixtures/password-protected.pdf` is a locked one
- `src/types.ts`: Task, Course, Semester (copied from the client), Review and Inputs

- `src/data/semester.ts`: sample semester data used by the in-memory store
- `src/data/db.ts`: in-memory data utilities and `resetDb()` for tests
- `src/data/store.ts`: defines the shared Store interface
- `src/data/create-store.ts`: selects MemoryStore or SupabaseStore based on environment variables
- `src/data/memory-store.ts`: in-memory implementation of the Store interface
- `src/data/supabase-store.ts`: Supabase database implementation of the Store interface
- `src/data/database-error.ts`: shared database error handling
- `src/data/task-ids.ts`: utilities for task identifiers
- `db/schema.sql`, `db/seed.sql`, `db/reset.sql`: build the Supabase database (see above)
- `.env.example`: the names of the Supabase keys, with no values
### Student ownership

Every semester, course and task lookup takes the signed-in student's ID from the checked session. Course lookups return 404 unless the student is enrolled. Task reads, ticks, estimates and generated IDs are scoped to that student. A task's ID can therefore be the same in two accounts without sharing its contents. POST /tasks accepts only the student's enrolled courses. Shared reviews, syllabi, weights and course policies stay attached to the catalog course.

Apply `db/migration_own_semester.sql` before using this server with an existing database. It runs in one transaction and can be repeated; only ownerless tasks are deleted. It does not delete saved course reviews. Do not run reset.sql on a database you want to keep.

PowerShell example after signing in and keeping the session in `$session`:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/semester/sample -WebSession $session
```

The optional hosted store contract checks also need `SUPABASE_TEST_USER_ID`, the ID of an existing test student. Write checks still require `RUN_SUPABASE_WRITE_TESTS=true`; use a disposable account that already loaded its sample. Local checks do not load server/.env or connect to the hosted database.

### Find, join or create a course

All three catalog routes require a session. Search only suggests choices: it does not enroll anyone. Codes compare in upper case with whitespace, dashes, dots and underscores removed. For example, cs262, CS 262 and CS-262 find the same course. Names use literal case-insensitive substring search; punctuation does not become a wildcard. The enrolled flag belongs to the student making the request.

A duplicate create returns 409 with `{ error, course }` and does not enroll the caller or change the existing course's name. The student can explicitly join that returned course. New code and name values are trimmed and limited to 40 and 200 Unicode characters, matching the database CHECK constraints. A code made entirely of ignored separators is invalid. New IDs use the code's lowercase ASCII letters and digits, or course when none remain, adding -2, -3 and so on when taken.

The Supabase store uses the service-role-only create_catalog_course function for course creation and enrollment in one transaction. Its unique index stops normalized-code duplicates, including simultaneous requests; a code collision returns the winner, while an ID collision tries a suffix. Apply migration_course_catalog.sql with this server version. If old catalog rows already have the same normalized code, the migration aborts without merging or deleting them; decide how to resolve those rows before trying again.

PowerShell with an existing signed-in `$session`:

```powershell
Invoke-RestMethod -Uri 'http://localhost:3000/catalog?q=cs262' -WebSession $session
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/courses/cs262/enroll' -WebSession $session
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/courses' -WebSession $session -ContentType 'application/json' -Body '{"code":"CS 999","name":"New subject"}'
```
