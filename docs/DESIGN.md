# Crunch Week — Design

> Crunch Week empowers students to take control of their semester by turning their syllabi and insights from past students into a clear picture of what lies ahead, helping them plan for challenges before they happen.

This document describes what we are building and why. It is a working document — every decision in it was made by us, not found somewhere, and any of it can be argued with.

---

## 1. The thesis

The obvious objection to this project is that an AI assistant can already reason about your semester. That is true, and it is also why Crunch Week is not a chatbot.

An assistant can reason, but it cannot be trusted with a number, cannot hold verified state across fifteen weeks, and cannot reach you on a Tuesday night unprompted. So we split the work along exactly that line:

> **The model never produces a number. It decides what to ask, when to ask, and in what shape. Code decides what is true.**

**The model orchestrates.** It renders structured fields rather than prose, picks the question that matters right now, notices when its picture of a course has gone stale, and judges whether tonight deserves a notification.

**Code computes and enforces.** Every figure on screen came out of a tested function. Every hard limit — never more than N notifications a day, never during class, never twice about the same thing — is code the model cannot talk its way past.

That split is the trust argument, and it is what we say to anyone who asks why this is not just ChatGPT.

---

## 2. Inputs

Everything the system knows traces back to one of these nine. This is the complete surface.

### Setup — handed over once, in week one

| # | Input | How it arrives | Cost |
|---|-------|----------------|------|
| 01 | **A syllabus, per course** | PDF, Word, pasted text, or a photo | ~5 min per course, once |
| 02 | **A calendar subscription URL** | One paste from Moodle's calendar export | One paste, then free |
| 03 | **Your time reality** | Short form: when classes meet, hours available per week | ~2 min, once |

Input 01 is the richest object we get — it is the only one carrying grade weights, drop rules, late policy and attendance limits.

Input 02 matters more than it looks. Moodle's calendar export produces a **persistent subscription URL**, not a one-time file download. New, changed and deleted events propagate on their own within hours. The student pastes it once and never touches it again.

### Ongoing — given as the semester runs

| # | Input | How it arrives | Frequency |
|---|-------|----------------|-----------|
| 04 | **"Done."** | One tap on a task | Continuous |
| 05 | **"That took about N hours."** | One tap, right after 04 | Continuous |
| 06 | **"This changed."** | Student-initiated correction | Occasional |
| 07 | **"Yes, still accurate."** | Answering a question the app asked | Prompted |

Input 04 is the carrier. It is binary, requires no lookup, and nothing below it can be collected without it happening first. Input 05 rides on 04 and is the dataset nobody else has. Input 07 is how we survive mid-semester drift — the app asking is more reliable than the student remembering to report.

### Deferred — real inputs, not scheduled

| # | Input | Why it is deferred |
|---|-------|--------------------|
| 08 | **Earned scores** | Highest-friction input on the list: requires looking a number up elsewhere, several times a week, across five courses |
| 09 | **Life outside school** | Work shifts, practice, standing commitments. Improves the forecast; not required by it |

### Two honest limits

**The calendar feed only contains what the professor actually puts in Moodle**, which varies a lot by instructor. Some keep it current, some never open it.

**Many syllabi say "weekly quizzes" with no dates.** Structure parsing gets us less than the ideal case suggests.

Input 07 exists because of both of these.

---

## 3. Product decisions

### Settled

**Running grades are out of scope for now.** Computing "you are at 87.4%" requires input 08 — the least reliable thing on the list, gathered continuously, and wrong the moment someone skips a week. It also quietly assumes every professor keeps scores somewhere we can reach, which is false. Everything else in the product rests on better ground.

**Retention comes from the forecast improving, not from streaks.** Points and streaks get gamed, and they reward opening the app rather than doing the work. There is a better signal already in the data: the wall coming down. Week 12 is red; you finish something; it gets less red. Intrinsic, unfakeable, and it means exactly what it looks like.

**Crunch Week is never a place to study.** It organizes and tracks. The moment it starts explaining course material it is competing with ChatGPT on ChatGPT's ground, and losing. This constraint also protects the retention decision above from turning into engagement bait.

**Prototype data is hardcoded, and there is no model in this phase.** One fixture file, no server, no network — which removes async, loading states and error handling from the code the team has to understand.

### Open

**Is there a chat box at all?** Leaning no. The model speaking only through structured fields keeps the trust story clean and keeps us out of study-tool territory. But "can I skip Thursday?" is a real question that fields answer awkwardly.

**How far onto a phone does this go?** Expo Go covers demoing on real devices. Real push notifications need more, and that decision can wait.

---

## 4. Technology

| Layer | Choice |
|-------|--------|
| Client | Expo / React Native, expo-router, TypeScript |
| Tests | Jest + `@testing-library/react-native` |
| Server *(later phase)* | Express |
| Database *(later phase)* | Postgres via Supabase |

Mirrors the CS 262 sample monorepo. `npx expo start --web` gives a browser dev loop; Expo Go runs the app on a real phone from a QR code, with no app-store distribution involved.

The computation layer is framework-independent TypeScript, so it is unaffected by any of these choices.

---

## 5. This phase

Two screens, five functions, one fixture file.

**Screen 1 — Semester.** Everything due across all courses on one timeline, with weeks that are over capacity marked. Derived entirely from inputs 01–03, which is the point: it works in week one with no ongoing data at all.

**Screen 2 — This week.** What is in front of you now, and the completion tap. Marking something done visibly changes the forecast on screen 1 — the reward loop, demonstrated rather than described.

Screen layout is a separate working session. These are the two screens the input list argues for, not a finished design.

---

## 6. The computation layer

Plain data in, plain data out. No React, no network, no dates. This is the entire testable core — roughly 150 lines — and it survives any change of stack.

| Function | Does | Cases worth testing |
|----------|------|---------------------|
| `weeklyLoad` | Buckets estimated effort into 15 week slots | Task with no estimate; project spanning several weeks |
| `detectCrunch` | Flags weeks over the student's capacity | Consecutive weeks merge into one window; exactly at capacity is not a crunch |
| `startBy` | Works backward from a due date to a start date | Not enough time remains; zero-estimate task |
| `rankThisWeek` | Orders what is in front of you now | Ties; something already done; something overdue |
| `absencesRemaining` | Attendance allowance minus absences used | Course with no attendance policy at all |

These have no UI dependency, so they can be written before and alongside the screens.

---

## 7. Data shape

If a field is not used by one of the five functions or drawn on one of the two screens, it does not exist yet.

```ts
type Task = {
  id: string
  courseId: string
  title: string            // "Sprint 2 Demo"
  dueWeek: number          // 1–15
  estimatedHours: number | null
  done: boolean
}

type Course = {
  id: string
  code: string             // "CS 262"
  name: string
  attendance: { allowed: number; used: number } | null
}

type Semester = {
  label: string            // "Fall 2026"
  currentWeek: number
  weeklyCapacity: number   // 15
  courses: Course[]
  tasks: Task[]
}
```

Weeks are integers, not dates. Real dates arrive with the calendar feed in phase 2 — skipping them now removes an entire category of bug from the prototype.

---

## 8. Testing approach

The thesis decides what we test. We test the layer that computes, because that layer has exactly one right answer. We do not test whether a model interpreted a syllabus correctly or phrased advice well — that is unbounded, and it is where projects like this die.

**We test**

- All five functions, written failing first
- Both screens render the fixture and show the expected values
- The completion tap: mark a task done, assert the forecast changed

**We skip**

- End-to-end tests — nothing to integrate yet
- Snapshot tests — they pass without asserting anything real
- Mocking — nothing to mock with no network

When the model arrives in a later phase, it gets a different kind of test: that its output **fits the schema**, checked deterministically, plus accuracy thresholds against hand-labelled syllabi run on their own command. Never assertions about its wording.

---

## 9. Roadmap

Recorded so the vision can be honest about where this goes without claiming any of it exists yet.

| Phase | What lands | What it unlocks |
|-------|------------|-----------------|
| 2 | Server, database, calendar subscription (input 02) | Deadlines that stay current with no effort — the first real reason to keep the app |
| 3 | Syllabus intake via the model (input 01) | Setup drops from a form to a file drop; grade structure and policies become available |
| 4 | The hours tap and aggregation (input 05) | Forecasts stop being guesses; the crowd dataset starts accumulating |
| 5 | Notifications, model-timed and code-constrained | The app reaches out instead of waiting — the thing no assistant can do |
| 6 | Self-checking (input 07) | The app asks whether its picture is still true; mid-semester drift stops being fatal |

Each phase funds the next. Setup costs almost nothing and pays off immediately from structure alone, which gets the student back in the app. Being back in the app makes the completion tap natural. Completion carries the hours tap. Hours at scale becomes the crowd dataset, which is the only genuinely novel asset in the product.

On the shelf, not scheduled: running grades (input 08), outside commitments (input 09), and matching syllabus reading lists against library holdings.
