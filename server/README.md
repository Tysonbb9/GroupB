# Crunch Week server


Express + TypeScript REST API for the Crunch Week app. The server supports
two data stores: an in-memory MemoryStore and a hosted Supabase (Postgres)
SupabaseStore.

By default, the server uses MemoryStore with the sample data from
`src/data/semester.ts`. No Supabase account or credentials are required.
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
| `db/schema.sql` | Creates the tables (the four live tables, Better Auth's four login tables, and `enrollments`), their rules, and turns on Row Level Security |
| `db/migration_127_users_enrollments.sql` | Adds the login tables and `enrollments` to a database that already has data. Leaves existing rows alone. |
| `db/seed.sql` | Loads the sample data from `src/data/semester.ts`: 1 semester, 5 courses, 36 tasks |
| `db/reset.sql` | **Deletes every table and all data**, including saved reviews and accounts |

On an empty project:

1. In the Supabase dashboard, open **SQL Editor** and start a new query.
2. Paste all of `db/schema.sql` and press **Run**. It should say "Success. No rows returned".
3. Paste all of `db/seed.sql` and press **Run**. The last result should show
   `semester_rows 1`, `courses 5`, `tasks 36`, `reviews 0`.

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
`MemoryStore`, which loads sample data from `src/data/semester.ts`.

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
| GET | `/semester` | Whole semester: label, current week, capacity, courses, tasks | 200 | |
| GET | `/courses` | All courses | 200 | |
| GET | `/courses/:id` | One course | 200 | 404 |
| GET | `/tasks` | All tasks. Filters: `?courseId=`, `?week=`, `?done=true\|false` | 200 | 400 bad `week` or `done` |
| GET | `/tasks/:id` | One task | 200 | 404 |
| PATCH | `/semester` | Set the weekly capacity: `{ weeklyCapacity }`, a whole number of hours from 1 to 80. Returns the whole semester | 200 | 400 bad body |
| PATCH | `/tasks/:id` | Update `done` and/or `estimatedHours` | 200 | 400 bad body, 404 |
| POST | `/syllabus/text` | A syllabus PDF in (`Content-Type: application/pdf`), its text out | 200 | 400 empty, 413 over 10 MB, 415 not a PDF, 422 no text / locked / damaged / over 50 pages |
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

## Files

- `src/index.ts`: starts the server
- `src/app.ts`: all routes, apart from the syllabus router it mounts, and the session check in front of them
- `src/auth.ts`: login with Better Auth (US-21): where accounts are kept, how long sessions last, which addresses may sign in
- `src/testing/session.ts`: `signedIn()`, which signs up a test student so the route tests can call routes that need a session
- `src/syllabus/routes.ts`: `POST /syllabus/text`
- `src/syllabus/pdf-text.ts`: checks the upload and rebuilds lines from the PDF's text
- `src/syllabus/read-pdf.worker.mjs`: opens the PDF with pdf.js, in a worker thread. Plain JavaScript because pdf.js is an ES module, which the CommonJS server and Jest cannot load directly
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