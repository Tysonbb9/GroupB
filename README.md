# Crunch Week

Crunch Week is Group B's project for CS 262.

## Vision Statement

Crunch Week empowers students to take control of their semester by turning their syllabi and insights from past students into a clear picture of what lies ahead, helping them plan for challenges before they happen.

## Related Systems

Calendar and task-management tools show students when work is due, but typically do not show whether several deadlines will exceed the time a student has available. General-purpose AI assistants can reason about a semester, but they do not provide the verified calculations and persistent semester state that Crunch Week is designed around. Crunch Week focuses on forecasting weekly workload, identifying periods that exceed a student's capacity, and updating that forecast as work is completed.

## Current Prototype

The client currently demonstrates two routes:

- **Semester**: a 15-week workload forecast, capacity line, next-crunch summary, course attendance information, and a link to the weekly view.
- **This week**: ranked outstanding work with overdue items first, estimated effort, start-by guidance, and a **Done** action.

Completing a task removes it from the outstanding work and lowers the projected workload. The prototype uses hard-coded data in [`client/src/data/semester.ts`](client/src/data/semester.ts); there is no server, database, authentication, network integration, syllabus parser, or model in this phase.

## Team

- Tyson Bobeldyk
- Gabby Odhiambo
- Nhyira Mante
- TJ French
- Bithiah Botsha
- Colin Redder

The team's working agreements are recorded in the [team contract](TeamContract.md).

## Running the Project

From the repository root:

```bash
npm run install:all
npm run web
```

Other useful commands:

```bash
npm test
npm run typecheck
npm run client
```

The client can also be started directly from `client/` with `npx expo start`. Expo Go can be used to run the prototype on a phone, or press `w` after starting Expo to open the web version.

## Repository Guide

- [`TeamContract.md`](TeamContract.md) - team working agreement
- [`docs/DESIGN.md`](docs/DESIGN.md) - product thesis, scope, data model, and roadmap
- [`docs/CODE.md`](docs/CODE.md) - code walkthrough, testing approach, and extension guide
- [`client/`](client/) - Expo / React Native client prototype
- [`server/`](server/) - reserved for a later backend phase
