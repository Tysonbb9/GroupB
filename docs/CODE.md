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

### `src/components/WeekStrip.tsx`

The bar chart. Fifteen bars, height proportional to projected hours, colour from `loadColor` in `theme.ts`, and a dashed line at the student's capacity so "over the line" is literal.

Each bar is a button with `testID="week-bar-N"` and an accessibility label naming its week and hours. Tapping it selects that week (`onSelectWeek`). The selected week's bar is outlined, starting with the current week, and the current week's axis number is in the accent colour. The next week over capacity (`wallWeek`) is numbered in the warning colour.

### `src/components/WeekFigures.tsx`

The two figures above the strip: hours landing this week against hours available, and which week is the next wall (or "none"). Both have accessibility labels.

### `src/components/WallCard.tsx`

The one place on the Semester screen that tells the student what to do: the next wall's hours against capacity, the length of the heavy stretch when it is more than one week ("Weeks 6–7 are over capacity"), and one assignment to start with the week to start it ("Start Midterm 1 in week 5", or "now" when that week has arrived). When nothing is over capacity it says so and recommends nothing.

### `src/components/WeekDetail.tsx`

The assignments behind the selected week, each with the hours it puts into that week. It answers "why is this bar tall?".

### `src/components/EstimateEditor.tsx`

An **Add estimate** link for a task that has no estimate. Saving runs the text through `parseEstimate`; invalid text shows an error and saves nothing. Once a task has an estimate the link goes away. A task with no estimate stays in the list and contributes nothing to the forecast until it has one.

### `src/components/TaskRow.tsx`

One assignment as a row on the This week screen: category tile, title, details (course, hours or "Add estimate", "Was week N", "start now") and a circular checkbox. The checkbox has `accessibilityRole="checkbox"` and a label naming the work it completes.

### `src/components/CategoryTile.tsx`

The two-letter tile, coloured by category through `categoryColor` in `theme.ts`. The letters mean colour is never the only signal.

### `src/components/ComingUp.tsx`

The two-column grid of upcoming assignments on the Semester screen. Each card has a category badge and colour edge, the title, the week and course, and the estimated hours when there are any. There is no difficulty meter: that needs hours recorded by other students, which does not exist yet.

### `src/components/SpikeNotice.tsx`

The in-app heads-up cards immediately below the wall card. Each one names the course, week, projected course hours and weekly capacity in words. The section says that difficulty is based on estimated hours, and does not use push notifications.

### `src/components/SyllabusReminder.tsx`

US-26. A card under the heads-up notices that says "Keep your syllabi up to date" and why: if a class changed its schedule, the student should update its syllabus so the forecast stays accurate. The SRS has not decided when or how often reminders appear (OI-09), so it shows whenever the Semester screen opens, and a **Dismiss** button hides it until the app is opened again. Nothing is stored. It has no link to follow, because there is no syllabus upload screen yet (US-28 and US-29).

### `src/components/DifficultySummary.tsx`

The per-course summary after Coming up. It names every course with a spike, its peak week and hours, and all spike weeks. Text and accessibility labels carry the meaning, so colour is never the only signal.

### `src/components/CourseChips.tsx`

One chip per course in a row that scrolls sideways, with a status dot from `attendanceStatus`.

### `src/components/Figure.tsx`, `SectionHeader.tsx`

`Figure` is one large number with a small label; `WeekFigures` and the This week screen both use it. `SectionHeader` is the small-caps heading with a rule that starts each group.

### `src/components/ServerStatus.tsx`

`LoadingView` (a spinner and "Loading your semester") and `ErrorView` (the error message and a **Try again** button). Only the provider uses them, while the semester is loading or has failed to load.

### `src/app/_layout.tsx`

expo-router's root. Wraps everything in `SemesterProvider` and defines the three routes: `/`, `/week` and `/login`. It also reads `EXPO_PUBLIC_USE_FIXTURE`: when that is `1` it passes the fixture as `initial`, otherwise it passes `undefined`, which makes the provider fetch from the server.

### `src/app/index.tsx` — screen 1, Semester

Route: `/`

Semester label and week with a **Log in** link beside them, the week figures and week strip, the wall card (with a **Plan →** link to screen 2), the detail for the selected week, the Coming up grid, the course chips, and a button to screen 2.

It calls `weeklyLoad` and `nextWall` on every render. That is fine at this size and clearer than caching.

### `src/app/week.tsx` — screen 2, This week

Route: `/week`

Two figures (hours landing this week against capacity, and items left to do), then the outstanding work in `groupThisWeek`'s groups: Overdue, Due this week, Next week. Each `TaskRow` has a circular checkbox calling `toggleDone` and, when the task has no estimate, an **Add estimate** link calling `setEstimate`.

Tick the checkbox and three things happen at once: the task leaves the list, this week's hours drop, and the bar on screen 1 gets shorter. All from that one `done: true`.

### `src/app/login.tsx` — Log in

Route: `/login`, reached from the **Log in** link on the Semester screen (US-27).

An email field and a password field, with the password hidden. It checks that both are filled in and that the email looks like an email. There is no sign-in behind it yet, so a valid form shows "Sign-in is not connected yet. This is a preview of the login screen." instead of pretending to log the student in. Real authentication is US-19 to US-21.

### `src/theme.ts`

Colours and spacing in one object. `loadColor(hours, capacity)` maps a week's load band to its colour, and `categoryColor(category)` gives a category's colour (neutral when unknown). The three colour systems (interface, load bands, categories) are never mixed: no element takes colour from more than one.

---

## Tests

531 tests across nineteen test suites.

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
| `src/__tests__/semester-stories.test.tsx` | 16 | US-01, US-02, US-03: the week strip, figures and load bands |
| `src/__tests__/start-by-recommendation.test.tsx` | 6 | US-15, US-04, US-05: the wall card and start-by recommendation |
| `src/__tests__/estimate-hours.test.tsx` | 11 | US-12, US-13: adding an estimate, and tasks without one |
| `src/__tests__/assignments-by-week.test.tsx` | 10 | US-25 (visual depiction): tap a week to see its assignments |
| `src/__tests__/ui-design.test.tsx` | 27 | the UI design: grouped rows, categories, Coming up, course chips, plan link |
| `src/__tests__/semester-from-server.test.tsx` | 4 | the provider: loading, then the app; the error screen; Try again; `initial` skips the server |
| `src/__tests__/capacity-from-server.test.tsx` | 2 | US-02 with server data: the capacity on screen is the one the server sent |
| `src/__tests__/login.test.tsx` | 6 | US-27: the Log in link, the email and password form, the checks on both fields, and that it never pretends to sign in |
| `src/__tests__/input-processing.test.ts` | 16 | US-24 told as the story: scan a syllabus, see the forecast and crunch change, crowd estimates, nothing mutated. Runs the real workload functions, nothing mocked |
| `src/lib/difficulty.test.ts` | 5 | course spike threshold, peaks, ignored work, project spreading, lookahead and notice limit |
| `src/__tests__/difficulty-summary.test.tsx` | 4 | spike notices, empty state, course summary text and accessibility labels |
| `src/__tests__/syllabus-reminder.test.tsx` | 6 | US-26: the reminder's text and screen reader label, the Dismiss button, and that it shows on the Semester screen in place of the old one-line text |

The server has its own tests in `server/src/__tests__/`, run with `npm test` inside `server/` or `npm run test:server` from the root: 246 of them in eight files, plus 13 still marked to-do. Two of them cover US-02: `GET /semester` has to include the weekly capacity and the current week. The PDF reader's tests are `pdf-text.test.ts` (rebuilding lines from text positions), `pdf-extract.test.ts` (real PDFs read through the worker) and `syllabus-route.test.ts` (the `POST /syllabus/text` endpoint). `reviews.test.ts` covers US-22: `POST /courses/:id/reviews` (saving, 400 for a missing title or zero hours, 404 for an unknown course) and `GET /courses/:id/reviews`.

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

No database. The server keeps the semester in memory, so any change is lost when it restarts, and marking work done or adding an estimate in the app is not yet saved back to the server.

No real sign-in and no accounts: the login screen is a preview with nothing behind it. No model. The syllabus scanner in `lib/inputs.ts` reads text in one fixed format, and the server can pull that text out of a PDF, but no screen uses either yet, and photos and scanned PDFs are not read at all. No real dates: weeks are integers 1–15, which removes an entire category of bug from a prototype.

No running grades. That needs the student to enter every score, which is the least reliable input available to us. DESIGN.md section 3 has the argument.
