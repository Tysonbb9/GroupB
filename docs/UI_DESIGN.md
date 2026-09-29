# Crunch Week: User Interface Design

This document covers the user interface: who uses it, what each screen is for, how
the screens relate, and the visual language they share.

It is the working session that [DESIGN.md](DESIGN.md) §5 deferred. DESIGN.md decides
*what the product does and why*; this document decides *what the user sees and
touches*. [CODE.md](CODE.md) describes how it is built.

Drawn versions of every screen described here are in
[`docs/ui/screens.html`](ui/screens.html). Open that file in a browser alongside this
document; the numbered markers there match the region names used below.

---

## 1. Who this is for

One user: **a student in the middle of a semester.**

Three things about the context of use shape every decision below.

**It is used on a phone, briefly, between other things.** Walking out of a lecture,
sitting down in the library, last thing at night. Not at a desk, not for long.

**It is opened when the student is already behind or worried.** That is the moment
the product is for. The interface should reduce the number of things to work out,
not add to them.

**It is checked often and edited rarely.** Reading the forecast is the common case.
Marking something done is the only routine write. Everything else is setup, and
setup happens once.

That ratio is the reason the app opens straight onto the forecast rather than a
menu, a dashboard, or a login.

---

## 2. Design principles

These come from the product thesis in DESIGN.md and constrain the interface.

**The count must be true.** No screen shows a number the computation layer did not
produce. Where a value is unknown, the interface says so rather than estimating.
An unestimated task shows no hours, and an assignment with no recorded history shows
no difficulty meter.

**Every warning carries an action.** Telling a student that week 6 is overloaded,
with no way to act on it, adds worry without reducing it. Where the interface reports
a problem it also names the next step: which assignment to start, and when.

**Show scale, not just dates.** A list of due dates is what every calendar already
does. Bar height and the difficulty meter are the product: they are what say how
*big* something is, not just when it lands.

**Work should be recognisable at a glance.** Assignments carry a category, and that
category sets a colour and a tile wherever the assignment appears. A problem set
should not look like an essay from across the room.

**The reward is the wall coming down.** There are no points, streaks or badges.
Finishing work visibly shortens a bar, and that is the entire feedback mechanism.
It cannot be farmed, and it means exactly what it appears to mean.

**Never a place to study.** The interface organises and tracks. It does not explain
course material. This keeps the product out of competition with tools that do that
better, and keeps the screens small.

---

## 3. Information architecture

Two screens in this phase, in a stack.

```
Semester  (/)                    the forecast, the landing screen
    │
    │  "See this week", or tapping a week
    ▼
This week (/week)                outstanding work, the done action
    │
    └─ back ─────────────────►   returns with the forecast already updated
```

Navigation is one level deep. There is no tab bar and no drawer in this phase.

A course chip on screen 1 opens that course's detail. That view is specified in §9 as
a later phase, but the entry point to it is designed here so the course list is not a
dead end.

**Why the forecast is the landing screen.** It is derived entirely from setup inputs
01 to 03 (see DESIGN.md §2), so it is useful in week one before the student has
entered anything ongoing. Opening on the thing that works with no user data is what
makes the app worth returning to.

---

## 4. Screen 1: Semester

**Route:** `/` · **Purpose:** how heavy is the rest of my semester, where is the next
wall, and what should I start.

### Regions

| Region | Content | Why it is here |
|---|---|---|
| Week figures | Hours landing this week against hours available; which week is the next wall | Answers "how am I doing" before the student reads a chart |
| Week strip | 15 bars, one per week, with a dashed capacity line | The signature view. The only place the scale of a whole semester is visible |
| Wall card | The next week over capacity, its two figures, and one recommended action | Turns the forecast into something the student can act on today |
| Coming up | A two-column grid of the next assignments, with category and difficulty | Gives the forecast specifics without becoming a full task list |
| Course chips | A horizontal row, one per course, with attendance status | Reference material that takes one row rather than five |

### The week strip

Bar height is projected hours relative to the tallest week, so the chart always fills
its space. The dashed line sits at the student's weekly capacity, which makes "over
the line" literal rather than a colour the user has to learn.

The current week is outlined and its axis number is emphasised. The next week over
capacity is marked on the axis in the warning colour, so the two weeks that matter
are findable without counting.

### The wall card

The heading states the week and both figures: what the week needs, and what the
student has. Beneath it sits one action naming the assignment to start, the week to
start it in, and the hours other students recorded for it.

This is the one place on screen 1 that tells the student to do something. It is
deliberately singular; a list of recommendations would be another list.

### Coming up

Two columns, not a list. Each card carries the assignment's category badge and colour
bar, its title, the week and course, and a difficulty meter. Ordered by when the work
needs to start rather than by due date alone, since a large assignment due later can
need starting sooner than a small one due soon.

### States

| State | What the screen shows |
|---|---|
| Crunch ahead | Wall card present, with its week marked on the axis |
| Nothing over capacity | Wall card is replaced by a single calm line stating that every remaining week fits |
| Course with no attendance policy | Chip reads "no policy", which is deliberately different from "0 left" |
| Assignment with no recorded hours | Card shows no difficulty meter rather than a guess |

---

## 5. Screen 2: This week

**Route:** `/week` · **Purpose:** what should I do now, and a way to mark it done.

### Regions

| Region | Content |
|---|---|
| Week figures | Hours landing this week against hours available, and the count of outstanding items |
| Task groups | Outstanding work under **Overdue**, **Due this week**, and **Next week** |

### Grouping and ordering

Work is grouped by urgency band first, then ordered within each band by soonest due,
then by the larger job, then alphabetically. The last tiebreaker exists so the order
never shifts unpredictably between renders.

Ordering is a UI decision with real consequences: a four-hour project and a
ten-minute reading due the same day are not equally urgent, so size breaks the tie
after date.

Grouping also constrains the "start now" flag, which appears only on work that is not
yet due but whose backward-planned start week has arrived. Inside the Due this week
group it would be true of everything and would stop meaning anything.

### Two arrangements

Both are drawn in [`docs/ui/screens.html`](ui/screens.html). The content and grouping
are identical; only the arrangement differs.

**Option A, rows.** One row per assignment: category tile on the left, title and
metadata in the middle, checkbox on the right. Denser, and the vertical rhythm makes
a long week quick to scan.

**Option B, cards.** Square cards in two columns, category tile and checkbox at the
top, metadata at the bottom, title given the middle of the card. Fewer items visible
at once, but each item reads as an object rather than a line.

*Open: which arrangement ships. The decision affects how a heavy week reads, since
option B halves the number of items visible without scrolling.*

### Marking work done

A circular checkbox, not a labelled button. It reads as a state to toggle rather than
an action competing with the assignment title for attention.

### Item states

| State | Treatment |
|---|---|
| Overdue | Grouped under Overdue; the week it was due shown in the warning colour |
| Start now | Flagged in the accent colour on work not yet due |
| No estimate | Hours and difficulty meter both omitted rather than shown as zero |
| Nothing left | Replaces the groups with a single confirming message |

---

## 6. The core interaction

One gesture carries the product.

```
tap the checkbox  →  task leaves the list
                  →  this week's hours drop
                  →  the bar on screen 1 gets shorter
```

All three follow from one field changing. The student is never told they were
rewarded; they see less work than before.

This is also why both screens read from one shared source rather than each loading
its own copy. Without that, the third effect would not happen, and the loop would
not exist.

---

## 7. Visual language

Defined in [`client/src/theme.ts`](../client/src/theme.ts) so the screens cannot
drift apart.

### Three colour systems, and when each applies

The interface uses colour for three separate jobs. Keeping them apart is what stops
the screens becoming noisy as more is added.

| System | Job | May be used for |
|---|---|---|
| Interface | Structure and action | Backgrounds, text, rules, the primary action |
| Load bands | How a week sits against capacity | Bars, week markers, the wall card's edge |
| Categories | What kind of work an assignment is | Category tiles, badges, card edges |

No element takes colour from more than one system. A category tile never changes with
load; a bar never changes with category.

### Interface palette

| Token | Value | Role |
|---|---|---|
| `bg` | `#F3F6F6` | Page ground |
| `surface` | `#FFFFFF` | Cards and rows |
| `ink` | `#16202A` | Primary text |
| `muted` | `#5A6A72` | Secondary text |
| `faint` | `#93A3A8` | Labels, axis, disabled |
| `rule` | `#DCE4E4` | Dividers and borders |
| `accent` | `#1F5C6B` | Primary action, links, "start now" |
| `accentSoft` | `#E2EDEF` | Accent backgrounds |

### Load bands

A week's colour is a function of its hours against the student's own capacity, not a
fixed threshold:

| Band | Condition | Token | Value |
|---|---|---|---|
| Calm | at or below two-thirds of capacity | `calm` | `#3F7F6E` |
| Moderate | above two-thirds, at or below capacity | `moderate` | `#B8912A` |
| Over capacity | above capacity | `heavy` | `#A93F30` |

A week exactly at capacity reads as moderate, not as a crunch: it fits, barely.

### Category palette

| Category | Tile | Value | Covers |
|---|---|---|---|
| Exam | `EX` | `#7B3F6E` | Midterms, finals, and quizzes that require study |
| Project | `PJ` | `#35507F` | Multi-week builds, demos, and presentations |
| Problem set | `PS` | `#2E6B5A` | Problem sets and short graded exercises |
| Reading | `RD` | `#6E5A2E` | Readings and reading responses |
| Writing | `WR` | `#8A4A35` | Essays, reports, and written deliverables |
| Lab / homework | `HW` | `#46607A` | Labs and routine weekly homework |

### Spacing and shape

A single scale of 4, 8, 16, 24 and 32, and one corner radius of 6. Layout uses gaps
between siblings rather than per-element margins, so spacing stays even as content
changes.

---

## 8. Categories

Every assignment carries exactly one category from the fixed set in §7. The category
sets the colour and the two-letter tile used wherever that assignment appears.

**Where categories come from.** They are assigned at intake, when a syllabus is read.
This is the model's job, and it fits the split in DESIGN.md §1 exactly: the model
decides the shape of the data, code decides the numbers. A category is a label, not a
figure, so nothing about the count depends on the model getting it right.

**The set is fixed and small.** Six is enough to tell work apart without becoming a
taxonomy nobody maintains. A fixed set is also what lets colour stay meaningful
across screens: if categories were open-ended, colour would stop carrying information.

**When the category is unknown.** An assignment the model cannot classify is not a
failure state. It takes a neutral tile in `faint` with no letters, keeps every other
property, and sorts normally. The student can set the category by hand.

---

## 9. Difficulty

The three-bar meter and the hours beside it report **the time students recorded for
that assignment in previous semesters**. It is not a judgement of how hard the work is
and it is not generated. One bar is light, two moderate, three heavy, measured
relative to the student's weekly capacity.

This obeys "the count must be true": the figure is computed from recorded data, so
where there is no data there is no meter. An assignment nobody has reported hours for
shows its title and course and nothing else.

**This depends on data that does not exist yet.** Crowd-sourced hours arrive in phase
4 of the DESIGN.md roadmap. Until then the meter has nothing to draw, and the
interface should show it absent rather than populated from the fixture. What the
prototype demonstrates and what the product can currently do should not differ.

---

## 10. Accessibility

**Colour is never the only signal.** The wall card states the week and the hours in
words, the capacity line is a dashed rule rather than a colour change, every bar
carries a label naming its week and hours, and every category tile carries two
letters as well as a colour.

**Every bar is labelled** as "Week N, H hours" for screen readers, rather than being
an unlabelled shape.

**Actions are labelled by what they do**, including the item they act on, so "Mark
Sprint 2 Demo done" rather than "Done" alone.

**Touch targets and tile legibility need checking.** The category tile is small and
its lettering smaller. Both the tile and the checkbox should be measured against
minimum touch target guidance before this ships to anyone outside the team.

---

## 11. Not designed yet

Deliberately out of scope for this phase. Each maps to a roadmap phase in DESIGN.md §9.

| Screen or state | Waits on |
|---|---|
| Course detail, reached from a course chip | Phase 2 |
| Week detail, reached from the wall card's plan action | Phase 2 |
| Setup: syllabus upload, calendar link, capacity | Phase 2 to 3 |
| The "how long did that take?" prompt after done | Phase 4 |
| Notification content and timing | Phase 5 |
| "Is this still accurate?" confirmation prompts | Phase 6 |
| Loading, offline and error states | A server existing at all |
| Empty state for a student with no courses yet | Setup existing |

---

## 12. Open questions

- **Which screen 2 arrangement ships**, rows or cards. See §5.
- **Dark mode.** The palette is light-only, and there are now three colour systems to
  carry across. Worth deciding before more screens exist.
- **Contrast has not been measured.** `faint` on `bg`, and the category tile lettering,
  should both be checked against WCAG AA.
- **Whether the difficulty meter appears at all in this phase**, given §9. Showing it
  from fixture data would demonstrate something the product cannot yet do.
- **How the week strip behaves beyond 15 weeks.** Fifteen bars fit comfortably;
  thirty would not.
