# Code walkthrough

Read this once, top to bottom, and you will know the whole prototype. That is the goal — every one of us has to be able to explain any file in here.

For *what* we are building and why, see [DESIGN.md](DESIGN.md). This document is only about the code.

---

## Running it

From the repo root:

```bash
npm run install:all     # installs client and server dependencies
npm run web             # opens the app in a browser
npm test                # runs all the client tests
npm run test:server     # runs all the server tests
```

Or from `client/`:

```bash
npx expo start          # then press w for web, or scan the QR code with Expo Go
```

**On your phone:** install Expo Go from the App Store, run `npx expo start`, scan the QR code. No Apple Developer account, no build step.

### With the server (the default)

The app loads its semester from the server in `server/`, so start that first, from the repo root:

```bash
npm run server          # installs, then listens on port 3000
```

Then start the client as above. In development the client works out the server's address by itself: it reuses the address of the computer running Expo, with port 3000, so a phone needs no setup as long as it is on the same network as the computer.

To point at a different server, set `EXPO_PUBLIC_API_URL`, for example in `client/.env.local` (git ignores it):

```
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000
```

Restart with `npx expo start -c` after changing it, because Expo copies `EXPO_PUBLIC_` variables into the app when it builds the bundle. A release build must have this set. It never falls back to localhost.

If the server cannot be reached, the app shows an error screen with the address it tried and a **Try again** button.

### Without the server

Set `EXPO_PUBLIC_USE_FIXTURE=1` (also in `client/.env.local`) to run on the hard-coded semester in `data/semester.ts` instead. This is a manual switch. The app never falls back to the fixture by itself, so a server that is down always shows.

---

## The shape

Three layers, and data only ever flows one direction:

```
data/semester.ts     the hardcoded fixture — one fake student's semester
       ↓
lib/*.ts             pure functions — arithmetic over that data
       ↓
app/*.tsx            screens — draw what the functions return
```

`lib/` never imports from `app/`. It does not know React exists. That is why it is easy to test and why it survived when real data replaced the fixture.

Since Sprint 3 the semester comes from the server, not from `data/semester.ts`. The only code that talks to the server is `lib/api.ts`, and the only code that decides when to ask is the provider in `state/semester-store.tsx`. Nothing in `lib/` or the screens changed.

---

## Every file

### `src/lib/types.ts`

The entire data model: `Task`, `Course`, `Semester`, plus two small result types. About 60 lines, mostly comments.

Start here. Everything else assumes you have read it.

Two fields deserve a note:

- **`estimatedHours: number | null`** — `null` means nobody has estimated it yet, which is different from zero. Several functions branch on this.
- **`spreadWeeks?: number`** — a 12-hour project with `spreadWeeks: 3` puts 4 hours in each of the three weeks up to its due week. Without this, a big project looks like it happens entirely on its due date.

### `src/lib/workload.ts`

All functions are pure. `weeklyLoad` and `assignmentsInWeek` both use `workSpan`, so the bars and the per-week lists cannot disagree.

| Function | In | Out |
|----------|-----|-----|
| `weeklyLoad` | tasks | 15 `{ week, hours }` entries |
| `detectCrunch` | those loads + capacity | the runs of weeks that are over capacity |
| `startBy` | one task + capacity | which week to start it |
| `loadBand` | hours + capacity | `calm`, `moderate` or `heavy` |
| `hoursInWeek` | loads + week | the hours in that week, or 0 |
| `nextWall` | loads + capacity + current week | the first week (this one included) over capacity, or `null` |
| `wholeHours` | hours | hours rounded up for display |
| `exactHours` | hours | hours to one decimal, for the parts that add up to a week |
| `hoursLabel` | hours | "1 hr", "2.5 hrs": the amount with the right unit |
| `plannedStart` | one task + capacity | the week to begin it: the earlier of where its work is spread from and `startBy` |
| `workSpan` | one task | the weeks its hours land in, and how many each week (null if it adds nothing to the forecast) |
| `assignmentsInWeek` | tasks + week | the assignments landing in that week with their share, biggest first |
| `recommendStart` | tasks + wall week + capacity | the assignment to start, and the week to start it (US-15) |
| `crunchPeriodAt` | loads + capacity + week | the run of over-capacity weeks containing that week |

**`loadBand` decides the colour of every bar.** Calm is at or below two-thirds of capacity, moderate is above that up to and including capacity, heavy is over capacity. `theme.ts` only maps a band to a colour.

**`weeklyLoad` only counts work that is not done.** That one line is the reward loop: finishing something takes its hours out of the forecast, so the bars get shorter. Nothing else in the app implements "reward."

**`detectCrunch` merges consecutive over-capacity weeks into one window**, because weeks 12, 13 and 14 all being bad is one problem, not three. A week exactly at capacity is not a crunch — it fits, barely.

### `src/lib/estimate.ts`

`parseEstimate` turns what the student typed into a value to store: a positive number up to 100, blank for "not estimated yet" (`null`), or invalid. It is separate from the editor so the rules can be tested without rendering anything.

### `src/lib/inputs.ts`

US-24: processing what the student hands over. Three steps, each pure, and nothing here touches the screens yet.

| Function | Does |
|----------|------|
| `scanSyllabus` | reads assignments out of syllabus **text**, one per line: `Week 7: Midterm 1 (8 hours)`. A line needs a week from 1 to 15 and a title; hours come from a trailing `(N hours)` only when they are a usable estimate. Lines it cannot read are returned in `skipped`, never dropped silently. A week range like `Week 5-7` is skipped rather than guessed at |
| `crowdEstimate` | the **median** of other students' reported hours, or `null` below `MIN_CROWD_REPORTS` (3) usable reports. Zero, negative, non-finite and over-100 reports do not count. Median rather than mean so one exaggerated report cannot drag it |
| `applyCrowdEstimates` | fills tasks that have **no** estimate from `crowdEstimate`, matching on course and title (ignoring case and spacing). A student's own estimate is never replaced |
| `processInputs` | scans each syllabus, adds only assignments the semester does not already have (so processing twice cannot double the workload), applies crowd estimates, then runs `weeklyLoad` and `detectCrunch` over the result |

A syllabus PDF is turned into text by the server's `POST /syllabus/text` (called through `extractSyllabusText` in `lib/api.ts`), and that text is what `scanSyllabus` reads. Reading photos and scanned PDFs, and matching reports to assignments any way other than course and title, are later work.

### `src/lib/review.ts`

US-30. `toDraft` turns a scanned assignment into the text in its edit boxes, and `checkDraft` checks one reviewed assignment: a title, a whole-number week from 1 to 15, and hours that `parseEstimate` accepts (blank means no estimate). It returns the first problem as a message the student can read.


### `src/lib/tasks.ts`

| Function | Does |
|----------|------|
| `rankThisWeek` | sorts outstanding work: overdue first, then soonest due, then the bigger job, then alphabetically so the order is stable |
| `groupThisWeek` | the This week screen's groups: Overdue, Due this week, Next week. Empty groups and work due later are left out |
| `comingUp` | the next few assignments, ordered by when the work needs to *start* rather than when it is due |
| `startsNow` | whether to flag "start now": not yet due, but the week to begin it has arrived. Never true for work already due, or the flag would mean nothing |
| `absencesRemaining` | `null` when a course has no attendance policy, which is not the same as a policy of zero |
| `attendanceStatus` | the chip text and tone: "no policy", "0 left", "1 absence", "3 absences" |

The last tiebreaker in `rankThisWeek` exists so tests do not depend on array order.

### `src/lib/difficulty.ts`

`courseSpikes` calculates each course's demanding weeks from the same `weeklyLoad` forecast used by the semester chart. A week is a spike when that course alone needs more than `SPIKE_SHARE`, currently 30%, of the student's weekly capacity. Exactly 30% is not a spike.

On the fixture, 30% gives CS 262, PHIL 153 and STAT 243 two spike weeks each, CS 336 four, and the exam-heavy MATH 251 six, so every course shows some spikes without most weeks being flagged. Completed work and work without an estimate do not count, and multi-week projects stay spread across their work span.

`upcomingSpikes` turns those summaries into at most three heads-up notices. It includes the current week and the following three weeks, then sorts nearest first. Both functions are pure and use only the semester already returned by `GET /semester`, so this feature needs no new endpoint.

### `src/lib/categories.ts`

The six assignment categories (exam, project, problem set, reading, writing, lab / homework) with each one's label and two-letter tile. The set is fixed on purpose, so colour keeps its meaning. A task with no `category` is not an error: it gets a neutral tile with no letters.

### `src/lib/api.ts`

The one place the app talks to the server. `fetchSemester()` does a `GET /semester` and returns a `Semester`, or rejects with a message a person can read. It turns the three ways a request can go wrong into three messages:

- **The server cannot be reached.** `fetch` rejects, and we say `Could not reach the server at <address>`.
- **The server answers with an error.** `fetch` does not reject on a 404 or 500, so we check `response.ok` ourselves and say `The server answered 500`.
- **The data is the wrong shape.** The parsed body is typed `unknown` and passed through `isSemester`, a type guard that checks the top-level fields. If it fails we say `The server sent invalid semester data`. The check is shallow on purpose: it catches a wrong URL or a server that answered with something else, not every field of every task.

`extractSyllabusText(pdf)` does a `POST /syllabus/text` with a PDF and returns its text, one line per line of the PDF, for the syllabus scanner. When the server refuses the PDF (scanned, locked, damaged, too big) it rejects with the server's own message, because that message tells the student what to do. Its tests are in `src/lib/syllabus-api.test.ts`.

`resolveBaseUrl` decides the address and is separate so it can be tested without Expo: `EXPO_PUBLIC_API_URL` if set, otherwise (development only) the Expo computer's address with port 3000, otherwise an error. `isObject` returns `value is Record<string, unknown>`, which tells TypeScript the value is an object whose fields we know nothing about yet, so the checks can read `value.label` and test its type.

`addTasks` posts reviewed assignments to POST /tasks and returns them with their new ids, or rejects with the server's message.

### `src/data/semester.ts`

One fake student, five courses, 36 tasks. Every task has a category, and one (the discussion post) has no estimate on purpose so the "Add estimate" path can be seen. Everything the app displays comes from here.

This file is the shape of what syllabus intake and the calendar subscription will produce in phase 2. When real data arrives, this file goes away and nothing else has to change.

The app no longer reads this file by default. It is kept as the offline option behind `EXPO_PUBLIC_USE_FIXTURE=1`, and the server's seed data is a copy of it.

### `src/state/semester-store.tsx`

Plain React context holding the one semester, plus `toggleDone(taskId)` and `setEstimate(taskId, hours)`. Both go through one `updateTask` helper, and both change the forecast because the forecast is computed from the tasks.

It exists for one reason: marking a task done on the week screen has to change the forecast on the semester screen. Two screens, one source of truth.

No state library. If you know `useState` and `useContext`, you know this file.

`SemesterProvider` takes an optional `initial` prop, and that decides where the semester comes from:

- **`initial` given:** use it as is. Tests do this, and so does the fixture switch in `_layout.tsx`. The server is never called.
- **`initial` not given:** `SemesterFromServer` calls `fetchSemester()`, shows `LoadingView` while it waits, shows `ErrorView` if it fails, and on success hands the semester to `SemesterState`.

`SemesterState` is the original provider, unchanged: the `useState`, `toggleDone` and `setEstimate`. Splitting it out means the loading logic never touches it, and none of the existing tests had to change.

For now `toggleDone` and `setEstimate` change the semester in memory only. Saving them back to the server is a later step.

`addTasks` appends tasks the server has already saved (US-30).

### `src/state/session.tsx`

Who is signed in: `email`, `signIn(email)` and `signOut()`, in a React context. Log in is the app's front door, but there are no accounts yet (US-19 needs the server and the database), so signing in only records the email while the app is open; nothing is stored or sent. `useSession()` is for screens that need a session (Log in, the root layout). `useOptionalSession()` returns null outside a `SessionProvider`, so `LogOutButton` simply draws nothing when a screen is shown on its own in tests.

### `src/components/WeekStrip.tsx`

The bar chart. Fifteen bars, height proportional to projected hours, colour from `loadColor` in `theme.ts`, and a dashed line at the student's capacity so "over the line" is literal.

Each bar is a button with `testID="week-bar-N"` and an accessibility label naming its week and hours. Tapping it selects that week (`onSelectWeek`). The selected week's bar is outlined, starting with the current week, and the current week's axis number is in the accent colour. The next week over capacity (`wallWeek`) is numbered in the warning colour.

### `src/components/WeekFigures.tsx`

The two figures above the strip: hours landing this week against hours available, and which week is the next wall (or "none"). Both have accessibility labels.

### `src/components/WallCard.tsx`

The one place on Forecast that tells the student what to do, and the only solid-colour card in the app, so it reads as the thing to act on. It leads with the action ("Start Midterm 1 in week 5.", or "now" when that week has arrived) and the hours it takes, then says why: the next week over capacity with both figures, and how long the heavy stretch lasts ("Weeks 6–7 are over capacity"). A **Plan this week** button opens This week. When nothing is over capacity it is a quiet white card that says so.

### `src/components/WeekDetail.tsx`

The assignments behind the selected week, each with the hours it puts into that week. It answers "why is this bar tall?".

### `src/components/EstimateEditor.tsx`

An **Add estimate** link for a task that has no estimate. Saving runs the text through `parseEstimate`; invalid text shows an error and saves nothing. Once a task has an estimate the link goes away. A task with no estimate stays in the list and contributes nothing to the forecast until it has one.

### `src/components/TaskRow.tsx`

One assignment as a row on the This week screen: category tile, title, details (course, hours or "Add estimate", "Was week N", "start now") and a circle with a faint tick, so it reads as the thing to tap. The circle has `accessibilityRole="checkbox"` and a label naming the work it completes.

### `src/components/CompletedTasks.tsx`

The finished work on the This week screen (US-31). It draws one "Completed (n)" line, closed by default, and nothing at all when no task is done. Opening the line lists each finished task with a filled tick, and tapping it calls `onUndo` (the store's `toggleDone`), which puts the task back in the This week list and its hours back in the forecast. The circle has `accessibilityRole="checkbox"`, checked, with a label naming the task.

### `src/components/CategoryTile.tsx`

The two-letter tile, coloured by category through `categoryColor` in `theme.ts`. The letters mean colour is never the only signal.

### `src/components/SpikeNotice.tsx`

The heads-up cards on the Courses tab, for course spikes in the next three weeks. Each reads like a calendar entry: the week in a block, the course, its hours out of the weekly capacity, and a bar of how much of that week the course alone takes. The accessibility label says all of it in words. No push notifications.

### `src/components/SyllabusReminder.tsx`

US-26. A card at the end of the Courses tab that says "Keep your syllabi up to date" and why: if a class changed its schedule, the student should update its syllabus so the forecast stays accurate. The SRS has not decided when or how often reminders appear (OI-09), so it shows whenever the Courses screen opens, and a **Dismiss** button hides it until the app is opened again. Nothing is stored.

### `src/components/CourseCards.tsx`

The courses on the Courses tab, one card each: code and name, absences left (a status dot from `attendanceStatus`), a small 15-week strip of that course's own hours with its spike weeks in the heavy colour, and the peak in words ("Peaks in week 7 at 14 hours · weeks 5, 6 and 7"). It replaces the old course chips and difficulty list. Text and accessibility labels carry the meaning, so colour is never the only signal.

### `src/components/ScreenHeader.tsx`, `LoadPill.tsx`

Every tab draws its own header with `ScreenHeader`: a small line placing it in the semester ("Fall 2026 · Week 3 of 15"), a large title, and whatever belongs beside it. `LoadPill` is one word for this week against capacity, **Fits**, **Busy** or **Over**, in the same load colours as the bars.

### `src/components/SummaryRow.tsx`

A row that opens something else: an icon in a tinted circle, a title, one short line and a chevron. Forecast uses it for **Heads up** and **Course spikes** (both open Courses), and This week for **Later this semester** (opens Forecast).

### `src/components/LogOutButton.tsx`

The log-out icon beside the Forecast title. It calls `signOut()`, and the root layout takes the student back to Log in. It draws nothing when there is no session around the screen.

### `src/components/Figure.tsx`, `SectionHeader.tsx`

`Figure` is one large number with a small label; `WeekFigures` and the This week screen both use it. `SectionHeader` is the small-caps heading with a rule that starts each group.

### `src/components/ServerStatus.tsx`

`LoadingView` (a spinner and "Loading your semester") and `ErrorView` (the error message and a **Try again** button). Only the provider uses them, while the semester is loading or has failed to load.

### `src/app/_layout.tsx`

expo-router's root, and the front door. It holds the `SessionProvider` and a stack split with `Stack.Protected`: signed out, only `/login` exists; signed in, only the tabs and `/syllabus` do, and expo-router sends the student to whichever side is open. The `SemesterProvider` wraps the stack only once someone has signed in, so the semester loads after Log in and a server that is down never hides the Log in screen. It also reads `EXPO_PUBLIC_USE_FIXTURE`: when that is `1` it passes the fixture as `initial`, otherwise it passes `undefined`, which makes the provider fetch from the server.

### `src/app/(tabs)/_layout.tsx`

The tab bar from layout Option A (#96): **Forecast** (`/`), **This week** (`/week`) and **Courses** (`/courses`), one focus per screen, with icons from `@expo/vector-icons` (filled when the tab is open). A folder in brackets groups screens without changing their addresses, so `router.push('/week')` lands on the This week tab. Each screen draws its own header, so the tab bar's is hidden.

### `src/app/(tabs)/index.tsx` — screen 1, Forecast

Route: `/`

One focus: the header (with the load label and the log-out icon), the week figures and week strip, and the wall card with its **Plan this week** button. A week's assignments (`WeekDetail`) open when its bar is tapped and close on a second tap. Below, two rows open the Courses tab: **Heads up** (how many notices in the next three weeks) and **Course spikes** (the course with the heaviest single week).

It calls `weeklyLoad` and `nextWall` on every render. That is fine at this size and clearer than caching.

### `src/app/(tabs)/week.tsx` — screen 2, This week

Route: `/week`

Two figures (hours landing this week against capacity, and items left to do), then the outstanding work in `groupThisWeek`'s groups: Overdue, Due this week, Next week. Each `TaskRow` has a circular checkbox calling `toggleDone` and, when the task has no estimate, an **Add estimate** link calling `setEstimate`. Below the groups, `CompletedTasks` lists the done work behind a "Completed (n)" line, so a mistaken tap can be undone with `toggleDone`, and a **Later this semester** row counts the work due after next week and opens Forecast, where each week's bar lists it.

Tick the checkbox and three things happen at once: the task leaves the list, this week's hours drop, and the bar on screen 1 gets shorter. All from that one `done: true`.

### `src/app/(tabs)/courses.tsx`: screen 3, Courses

Route: `/courses`

The courses first (`CourseCards`), then **Heads up** (`SpikeNotice`) for the next three weeks, then the syllabus reminder. A **+ Syllabus** button in the header opens the syllabus screen. None of this needs acting on every day, so it lives here instead of crowding Forecast.

### `src/app/login.tsx` — Log in

Route: `/login`, the first screen of the app (US-27). Log out on Forecast comes back to it.

An email field and a password field, with the password hidden. It checks that both are filled in and that the email looks like an email. A valid form signs in through `state/session.tsx`, and the root layout opens the app. There are no accounts behind it yet, and a note under the form says so: any email and password open the app on this device. Real authentication is US-19 to US-21.

### `src/app/syllabus.tsx` — Add a syllabus

Route: `/syllabus`, reached from the **+ Syllabus** button on the Courses tab (US-28).

The student picks one of their courses, pastes or types the syllabus text, and presses **Find assignments**. The text goes through `scanSyllabus` from `lib/inputs.ts`, and the screen lists each assignment found (title, due week, and hours when the syllabus states them) and every line it could not read, so nothing is silently dropped. Each assignment found is shown as boxes for its title, due week and hours, with a Remove link (US-30). Add to semester checks every one with checkDraft (lib/review.ts) and shows a message on each bad one. When all are valid it saves them with POST /tasks and only then adds them to the semester, so the forecast never changes while the student is still reviewing.

### `src/theme.ts`

Colours and spacing in one object. `loadColor(hours, capacity)` maps a week's load band to its colour, and `categoryColor(category)` gives a category's colour (neutral when unknown). The three colour systems (interface, load bands, categories) are never mixed: no element takes colour from more than one.

---

## Server Data Access Layer

The Express server uses a Data Access Layer to separate API routes from database operations.

### `server/src/data/store.ts`

Defines the asynchronous `Store` interface for accessing semesters, courses, tasks, and reviews.

### `server/src/data/memory-store.ts`

Implements the `Store` interface using the existing in-memory database. This preserves development and test behavior without requiring Supabase credentials.

### `server/src/data/supabase-store.ts`

Implements the `Store` interface using `@supabase/supabase-js`. It reads and writes data in Supabase and maps database fields to the application's data types.

### `server/src/data/task-ids.ts`

`nextTaskId(courseId, taken)` gives each task added through POST /tasks the first free `<course>-syl-N` id. Both stores use it, so an added task gets the same kind of id either way.

### `server/src/data/create-store.ts`

Selects the storage implementation at startup:

- When `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are configured, the server uses `SupabaseStore`.
- Otherwise, the server uses `MemoryStore`.

The environment variables are configured in `server/.env`, which must never be committed to Git.

### `server/src/data/database-error.ts`

Defines `DatabaseError` for database query failures. The Express error handler returns HTTP 503 with a JSON error response for these failures.

### `server/src/app.ts`

The Express routes use asynchronous `Store` methods rather than directly accessing the in-memory database.

### Supabase SQL Scripts

The database setup scripts are located in `server/db/`:

- `server/db/schema.sql`: creates the Supabase database tables and relationships.
- `server/db/seed.sql`: populates the database with sample semester, course, and task data.
- `server/db/reset.sql`: resets the database for a fresh setup.

Run the SQL scripts using the Supabase SQL Editor.
See `server/README.md` for the setup instructions.

The server does not require these scripts when running with
`MemoryStore`, which is the default without Supabase credentials.

## Tests

594 tests across twenty-seven test suites.

```bash
npm test                      # all of them
npx jest src/lib              # just the pure functions
npx jest --watch              # while you work
```

| File | Count | Covers |
|------|-------|--------|
| `src/lib/workload.test.ts` | 52 | the forecast, bands, walls, start weeks and display helpers |
| `src/lib/tasks.test.ts` | 26 | ranking, grouping, Coming up, start now, attendance |
| `src/lib/estimate.test.ts` | 5 | `parseEstimate` |
| `src/lib/inputs.test.ts` | 287 | US-24: syllabus scanning, crowd estimates and `processInputs`, including boundaries, seeded random input, and hostile or oversized input |
| `src/lib/api.test.ts` | 12 | `fetchSemester` (success, bad status, wrong shape, unreachable) and `resolveBaseUrl` |
| `src/lib/syllabus-api.test.ts` | 24 | `extractSyllabusText`: posting the PDF, passing the server's message on when it refuses one, replies that are the wrong shape, and an unreachable server |
| `src/__tests__/screens.test.tsx` | 11 | both screens render; checking off work; the two screens together |
| `src/__tests__/tabs.test.tsx` | 4 | the tab bar: opens on Forecast, switches to This week and to Courses, and `/week` still lands on its tab |
| `src/__tests__/forecast-focus.test.tsx` | 12 | Option A (#96): what Forecast keeps and what moved to Courses, the Heads up and Course spikes rows, the Fits, Busy and Over label, and the Later this semester row |
| `src/__tests__/front-door.test.tsx` | 4 | Log in is the front door: the app opens on it, keeps every screen behind it, opens Forecast with the semester loaded after signing in, and comes back to it on log out |
| `src/__tests__/semester-stories.test.tsx` | 16 | US-01, US-02, US-03: the week strip, figures and load bands |
| `src/__tests__/start-by-recommendation.test.tsx` | 6 | US-15, US-04, US-05: the wall card and start-by recommendation |
| `src/__tests__/estimate-hours.test.tsx` | 11 | US-12, US-13: adding an estimate, and tasks without one |
| `src/__tests__/assignments-by-week.test.tsx` | 11 | US-25 (visual depiction): tap a week to see its assignments, and tap again to close them |
| `src/__tests__/ui-design.test.tsx` | 20 | the UI design: grouped rows, categories, course chips, plan link |
| `src/__tests__/semester-from-server.test.tsx` | 4 | the provider: loading, then the app; the error screen; Try again; `initial` skips the server |
| `src/__tests__/capacity-from-server.test.tsx` | 2 | US-02 with server data: the capacity on screen is the one the server sent |
| `src/__tests__/login.test.tsx` | 9 | US-27: the email and password form, the checks on both fields, signing in with a valid form, the note that there are no accounts yet, and Log out on Forecast |
| `src/__tests__/input-processing.test.ts` | 16 | US-24 told as the story: scan a syllabus, see the forecast and crunch change, crowd estimates, nothing mutated. Runs the real workload functions, nothing mocked |
| `src/lib/difficulty.test.ts` | 5 | course spike threshold, peaks, ignored work, project spreading, lookahead and notice limit |
| `src/__tests__/difficulty-summary.test.tsx` | 6 | the Heads up cards (week, course, hours, label, empty state) and the course cards (peak week, heavy weeks in words and labels, a course with none) |
| `src/__tests__/syllabus-reminder.test.tsx` | 6 | US-26: the reminder's text and screen reader label, the Dismiss button, and that it shows on the Courses screen in place of the old one-line text |
| `src/__tests__/syllabus-text.test.tsx` | 7 |  US-28: choosing a course, the assignments found shown in edit boxes with their week and hours, the lines it could not read, the empty case, that nothing is added to the semester, and the button on the Courses screen |
| `src/__tests__/undo-done.test.tsx` | 7 | US-31: the Completed line and its count, opening and closing it, moving a task there and back, the hours returning to this week and the forecast, the line going away after the last undo, and nothing drawn when no task is done. Queries by role and name, so the open and checked states are tested too |
| `src/lib/review.test.ts` | 18 | US-30: `toDraft`, and `checkDraft` accepting good values and rejecting a blank title, weeks outside 1 to 15 or not whole, and hours of 0, over 100 or not a number |
| `src/lib/add-tasks-api.test.ts` | 5 | `addTasks`: what it posts, the saved tasks it returns, the server's message on a refusal, an unreachable server, a reply that is not a list |
| `src/__tests__/review-before-adding.test.tsx` | 8 | US-30: editing and removing found assignments, messages for a bad week, bad hours or a blank title, the forecast unchanged while reviewing, adding on confirm, and a failed save |



The server has its own tests in `server/src/__tests__/`, run with `npm test` inside `server/` or `npm run test:server` from the root: 269 of them in ten files, plus 13 still marked to-do. Two of them cover US-02: `GET /semester` has to include the weekly capacity and the current week. The PDF reader's tests are `pdf-text.test.ts` (rebuilding lines from text positions), `pdf-extract.test.ts` (real PDFs read through the worker) and `syllabus-route.test.ts` (the `POST /syllabus/text` endpoint). `reviews.test.ts` covers US-22: `POST /courses/:id/reviews` (saving, 400 for a missing title or zero hours, 404 for an unknown course) and `GET /courses/:id/reviews`. `taskts.test.ts` also checks that `PATCH /tasks/:id` refuses an estimate of 0 or over 100, the same limits as the client and the database (TP-25, TP-26). `no-secrets.test.ts` fails if a Supabase key is in any file git would commit, and checks that `server/.env` is ignored (TP-44). The SQL that builds the Supabase database is in `server/db/`; see `server/README.md`. 
`add-tasks.test.ts` covers US-30: POST /tasks adds every task with a new id, saves them, rejects ten kinds of bad input with 400, and adds nothing when any one task is bad.


Shared test data for the story tests is in `src/testing/fixtures.ts`, outside `src/__tests__/` so Jest does not treat it as a test file.

**Screen tests live in `src/__tests__/`, not next to the screens.** Everything
inside `src/app/` is a route as far as expo-router is concerned, so a test file
in there gets bundled into the app and breaks it at runtime — while Jest still
passes, because Jest never touches the bundler. Keep `src/app/` for screens only.

**The original function tests (`workload`, `tasks`, `estimate`) were written before the functions existed.** That is the test-driven requirement, and the git history shows it. The US-24 and PDF reader tests were written after their code, in the same pull request.

The screen tests use their own small fixture — a two-course semester with numbers you can check in your head — rather than the real one, so an edit to `data/semester.ts` never breaks them.

Three tests carry the reward loop. Two are on the week screen alone: pressing
Done removes the task from the list, and drops this week's hours from 4 to 0.
The third renders **both screens under one provider** and asserts that pressing
Done on the week screen changes the wall on the semester screen — that is the
cross-screen behaviour the whole product rests on, so it gets its own test.

---

## Adding to it

**A new calculation** → a function in `lib/`, a test beside it, written first. It takes data and returns data. If it needs to import from React, it belongs in a screen instead.

**A new screen** → a file in `src/app/`. The filename is the route. Add it to `_layout.tsx` to give it a title.

**A new field** → `types.ts` first, then the fixture, then whatever uses it.

---

## Deliberately not here


The server now supports Supabase as its persistent database through the Data Access Layer. When `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are configured, the server uses Supabase; otherwise, it uses the existing in-memory store. The client still manages task completion and estimate changes locally, so those client-side changes are not yet automatically saved back to the server.

No real sign-in and no accounts: the login screen is a preview with nothing behind it. No model. The syllabus scanner in `lib/inputs.ts` reads text in one fixed format, and the server can pull that text out of a PDF, but no screen uses either yet, and photos and scanned PDFs are not read at all. No real dates: weeks are integers 1–15, which removes an entire category of bug from a prototype.

No running grades. That needs the student to enter every score, which is the least reliable input available to us. DESIGN.md section 3 has the argument.
