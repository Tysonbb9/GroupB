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

### `src/lib/categories.ts`

The six assignment categories (exam, project, problem set, reading, writing, lab / homework) with each one's label and two-letter tile. The set is fixed on purpose, so colour keeps its meaning. A task with no `category` is not an error: it gets a neutral tile with no letters.

### `src/data/semester.ts`

One fake student, five courses, 36 tasks. Every task has a category, and one (the discussion post) has no estimate on purpose so the "Add estimate" path can be seen. Everything the app displays comes from here.

This file is the shape of what syllabus intake and the calendar subscription will produce in phase 2. When real data arrives, this file goes away and nothing else has to change.

### `src/state/semester-store.tsx`

Plain React context holding the one semester, plus `toggleDone(taskId)` and `setEstimate(taskId, hours)`. Both go through one `updateTask` helper, and both change the forecast because the forecast is computed from the tasks.

It exists for one reason: marking a task done on the week screen has to change the forecast on the semester screen. Two screens, one source of truth.

No state library. If you know `useState` and `useContext`, you know this file.

The provider takes an optional `initial` prop so tests can supply their own semester instead of the fixture.

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

### `src/components/CourseChips.tsx`

One chip per course in a row that scrolls sideways, with a status dot from `attendanceStatus`.

### `src/components/Figure.tsx`, `SectionHeader.tsx`

`Figure` is one large number with a small label; `WeekFigures` and the This week screen both use it. `SectionHeader` is the small-caps heading with a rule that starts each group.

### `src/app/_layout.tsx`

expo-router's root. Wraps everything in `SemesterProvider` and defines the two routes. Twenty lines.

### `src/app/index.tsx` — screen 1, Semester

Route: `/`

Semester label and week, the week figures and week strip, the wall card (with a **Plan →** link to screen 2), the detail for the selected week, the Coming up grid, the course chips, and a button to screen 2.

It calls `weeklyLoad` and `nextWall` on every render. That is fine at this size and clearer than caching.

### `src/app/week.tsx` — screen 2, This week

Route: `/week`

Two figures (hours landing this week against capacity, and items left to do), then the outstanding work in `groupThisWeek`'s groups: Overdue, Due this week, Next week. Each `TaskRow` has a circular checkbox calling `toggleDone` and, when the task has no estimate, an **Add estimate** link calling `setEstimate`.

Tick the checkbox and three things happen at once: the task leaves the list, this week's hours drop, and the bar on screen 1 gets shorter. All from that one `done: true`.

### `src/theme.ts`

Colours and spacing in one object. `loadColor(hours, capacity)` maps a week's load band to its colour, and `categoryColor(category)` gives a category's colour (neutral when unknown). The three colour systems (interface, load bands, categories) are never mixed: no element takes colour from more than one.

---

## Tests

164 of them, in nine files.

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
| `src/__tests__/screens.test.tsx` | 11 | both screens render; checking off work; the two screens together |
| `src/__tests__/semester-stories.test.tsx` | 16 | US-01, US-02, US-03: the week strip, figures and load bands |
| `src/__tests__/start-by-recommendation.test.tsx` | 6 | US-15, US-04, US-05: the wall card and start-by recommendation |
| `src/__tests__/estimate-hours.test.tsx` | 11 | US-12, US-13: adding an estimate, and tasks without one |
| `src/__tests__/assignments-by-week.test.tsx` | 10 | US-25 (visual depiction): tap a week to see its assignments |
| `src/__tests__/ui-design.test.tsx` | 27 | the UI design: grouped rows, categories, Coming up, course chips, plan link |

Shared test data for the story tests is in `src/testing/fixtures.ts`, outside `src/__tests__/` so Jest does not treat it as a test file.

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
