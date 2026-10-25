# Crunch Week

Crunch Week is Group B's project for CS 262.

## Vision Statement

For college students facing exams, projects, and deadlines, Crunch Week is a mobile app that turns their course syllabi into a single semester timeline, highlighting the weeks where workload piles up. It also shows tips from students who previously took the same courses, so users know which assignments and exams need extra preparation. Unlike paper planners, Google Calendar, or Canvas, which only list due dates one course at a time, Crunch Week combines all of a student's courses to predict their hardest weeks and helps them start preparing early. It helps students inside the app: it warns them before a course's heaviest week, recommends which assignment to start first and in which week, and reminds them to keep their syllabi up to date. It does not send phone notifications or create calendar events.
 
## Related Systems

Calendar and task-management tools show students when work is due, but typically do not show whether several deadlines will exceed the time a student has available. General-purpose AI assistants can reason about a semester, but they do not provide the verified calculations and persistent semester state that Crunch Week is designed around. Crunch Week focuses on forecasting weekly workload, identifying periods that exceed a student's capacity, and updating that forecast as work is completed.

## Current Prototype

The prototype has two parts that run separately:

- **Server** (`server/`): an Express and TypeScript REST API on port 3000. It serves one semester of sample data (5 courses, 36 tasks) from memory, so any change is lost when the server restarts. There is no real database.
- **Client** (`client/`): an Expo / React Native app. When it starts it loads the semester from the server, showing a loading screen first and an error screen with a **Try again** button if the server cannot be reached.

The client has two routes:

- **Semester**: a 15-week workload forecast, capacity line, next-crunch summary, course attendance information, and a link to the weekly view.
- **This week**: ranked outstanding work with overdue items first, estimated effort, start-by guidance, and a **Done** action.

Completing a task removes it from the outstanding work and lowers the projected workload. For now that change lives only in the app and is not saved back to the server. There is no authentication, syllabus parser, or model in this phase.

## Team

- Tyson Bobeldyk
- Gabby Odhiambo
- Nhyira Mante
- TJ French
- Bithiah Botsha
- Colin Redder

The team's working agreements are recorded in the [team contract](TeamContract.md).

## Running the Project

You need Node.js and npm. The app loads its data from the server, so start the server first and keep it running. Use two terminals, both starting in the repository root.

**Terminal 1: the server**

```bash
npm run install:all
npm run server
```

Leave it running. It listens on http://localhost:3000. To check it, open http://localhost:3000/semester in a browser, which should show JSON.

**Terminal 2: the client**

```bash
npm run web
```

This opens the app in your browser. To use a phone instead, run `npm run client`, install Expo Go, and scan the QR code. The phone must be on the same Wi-Fi network as the computer running the server. In development the client works out the server's address by itself.

**If the app shows "Could not load your semester":** the server is not running or cannot be reached. Start it as above, then press **Try again**.

### Options

- **Point the client at a different server.** Create `client/.env.local` with one line, for example `EXPO_PUBLIC_API_URL=http://192.168.1.20:3000`, then restart with `npx expo start -c` from `client/`.
- **Run the client with no server.** Create `client/.env.local` containing `EXPO_PUBLIC_USE_FIXTURE=1` and restart with `npx expo start -c`. The app then uses the hard-coded semester in [`client/src/data/semester.ts`](client/src/data/semester.ts).

### Tests

From the repository root:

```bash
npm test                  # client tests
npm run test:server       # server tests
npm run typecheck         # client type check
npm run lint              # client lint, the coding standard checks in docs/CodingStandard.md
```

The same lint, type check and tests run automatically on GitHub for every pull request and every push to `main` (see `.github/workflows/ci.yml`).

More detail on each file and on the tests is in [`docs/CODE.md`](docs/CODE.md), and the server's endpoints are listed in [`server/README.md`](server/README.md).

## Repository Guide

- [`TeamContract.md`](TeamContract.md) - team working agreement
- [`docs/SRS.md`](docs/SRS.md) - requirements and user stories
- [`docs/DESIGN.md`](docs/DESIGN.md) - product thesis, scope, data model, and roadmap
- [`docs/UI_DESIGN.md`](docs/UI_DESIGN.md) - screens and interaction design
- [`docs/CODE.md`](docs/CODE.md) - code walkthrough, testing approach, and extension guide
- [`client/`](client/) - Expo / React Native client
- [`server/`](server/) - Express REST API with mocked data
