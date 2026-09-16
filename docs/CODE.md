# Code walkthrough

Read this once, top to bottom, and you will know the whole prototype. That is the goal — every one of us has to be able to explain any file in here.

For *what* we are building and why, see [DESIGN.md](DESIGN.md). This document is only about the code.

---

## Running it

From the repo root:

```bash
npm run install:all     # installs client dependencies
npm run web             # opens the app in a browser
npm test                # runs all 38 tests
```

Or from `client/`:

```bash
npx expo start          # then press w for web, or scan the QR code with Expo Go
```

**On your phone:** install Expo Go from the App Store, run `npx expo start`, scan the QR code. No Apple Developer account, no build step.

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

`lib/` never imports from `app/`. It does not know React exists. That is why it is easy to test and why it will survive when real data replaces the fixture.

---

## Every file

### `src/lib/types.ts`

The entire data model: `Task`, `Course`, `Semester`, plus two small result types. About 60 lines, mostly comments.

Start here. Everything else assumes you have read it.

Two fields deserve a note:

- **`estimatedHours: number | null`** — `null` means nobody has estimated it yet, which is different from zero. Several functions branch on this.
- **`spreadWeeks?: number`** — a 12-hour project with `spreadWeeks: 3` puts 4 hours in each of the three weeks up to its due week. Without this, a big project looks like it happens entirely on its due date.

### `src/lib/workload.ts`

Three functions, all pure.

| Function | In | Out |
|----------|-----|-----|
| `weeklyLoad` | tasks | 15 `{ week, hours }` entries |
| `detectCrunch` | those loads + capacity | the runs of weeks that are over capacity |
| `startBy` | one task + capacity | which week to start it |

**`weeklyLoad` only counts work that is not done.** That one line is the reward loop: finishing something takes its hours out of the forecast, so the bars get shorter. Nothing else in the app implements "reward."

**`detectCrunch` merges consecutive over-capacity weeks into one window**, because weeks 12, 13 and 14 all being bad is one problem, not three. A week exactly at capacity is not a crunch — it fits, barely.

### `src/lib/tasks.ts`

Two functions.

`rankThisWeek` sorts outstanding work by: overdue first, then soonest due, then bigger job first, then alphabetically so the order is stable. The last tiebreaker exists so tests do not depend on array order.

`absencesRemaining` returns `null` when a course has no attendance policy — which is not the same as a policy of zero, and the screen says so differently.

### `src/data/semester.ts`

One fake student, five courses, 35 tasks. Everything the app displays comes from here.

This file is the shape of what syllabus intake and the calendar subscription will produce in phase 2. When real data arrives, this file goes away and nothing else has to change.

### `src/state/semester-store.tsx`

Plain React context holding the one semester, plus `toggleDone(taskId)`.

It exists for one reason: marking a task done on the week screen has to change the forecast on the semester screen. Two screens, one source of truth.

No state library. If you know `useState` and `useContext`, you know this file.

The provider takes an optional `initial` prop so tests can supply their own semester instead of the fixture.

### `src/components/WeekStrip.tsx`

The bar chart. Fifteen bars, height proportional to projected hours, colour from `loadColor` in `theme.ts`, and a dashed line at the student's capacity so "over the line" is literal.

Each bar has `testID="week-bar-N"` and an accessibility label naming its week and hours.

### `src/app/_layout.tsx`

expo-router's root. Wraps everything in `SemesterProvider` and defines the two routes. Twenty lines.

### `src/app/index.tsx` — screen 1, Semester

Route: `/`

Semester label and week, the week strip, a callout naming the next wall, the course list with absences remaining, and a button to screen 2.

It calls `weeklyLoad` and `detectCrunch` on every render. That is fine at this size and clearer than caching.

### `src/app/week.tsx` — screen 2, This week

Route: `/week`

Current week's hours, then outstanding work ranked by `rankThisWeek`. Each row has a **Done** button calling `toggleDone`.

Press Done and three things happen at once: the task leaves the list, this week's hours drop, and the bar on screen 1 gets shorter. All from that one `done: true`.

### `src/theme.ts`

Colours and spacing in one object, plus `loadColor(hours, capacity)` which decides whether a week reads as calm, moderate, or over.

---

## Tests

38 of them, in three files.

```bash
npm test                      # all of them
npx jest src/lib              # just the pure functions
npx jest --watch              # while you work
```

| File | Count | Covers |
|------|-------|--------|
| `src/lib/workload.test.ts` | 17 | `weeklyLoad`, `detectCrunch`, `startBy` |
| `src/lib/tasks.test.ts` | 10 | `rankThisWeek`, `absencesRemaining` |
| `src/__tests__/screens.test.tsx` | 11 | both screens render; the Done button; the two screens together |

**Screen tests live in `src/__tests__/`, not next to the screens.** Everything
inside `src/app/` is a route as far as expo-router is concerned, so a test file
in there gets bundled into the app and breaks it at runtime — while Jest still
passes, because Jest never touches the bundler. Keep `src/app/` for screens only.

**The function tests were written before the functions existed.** That is the test-driven requirement, and the git history shows it.

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

No server, no database, no network calls — so no async, no loading states, no error handling.

No login, no accounts. No syllabus parsing and no model. No real dates: weeks are integers 1–15, which removes an entire category of bug from a prototype.

No running grades. That needs the student to enter every score, which is the least reliable input available to us. DESIGN.md section 3 has the argument.
