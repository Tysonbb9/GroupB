# Crunch Week server

Express + TypeScript REST API for the Crunch Week app. The database is
**mocked**: data is hardcoded in `src/data/semester.ts` and held in memory,
so changes are lost when the server restarts.

## Run it

```bash
cd server
npm install
npm run dev        # http://localhost:3000, restarts on save
```

## Test it

```bash
npm test           # Jest + Supertest, tests in src/__tests__/
npm run typecheck
```

## API

All responses are JSON. Errors look like `{ "error": "message" }`.

| Method | Path | Description | Success | Errors |
|---|---|---|---|---|
| GET | `/semester` | Whole semester: label, current week, capacity, courses, tasks | 200 | |
| GET | `/courses` | All courses | 200 | |
| GET | `/courses/:id` | One course | 200 | 404 |
| GET | `/tasks` | All tasks. Filters: `?courseId=`, `?week=`, `?done=true\|false` | 200 | 400 bad `week` or `done` |
| GET | `/tasks/:id` | One task | 200 | 404 |
| PATCH | `/tasks/:id` | Update `done` and/or `estimatedHours` | 200 | 400 bad body, 404 |

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

## Files

- `src/index.ts`: starts the server
- `src/app.ts`: all routes
- `src/types.ts`: Task, Course, Semester (copied from the client)
- `src/data/semester.ts`: the mock data
- `src/data/db.ts`: in-memory copy of the data, plus `resetDb()` for tests