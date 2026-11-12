# Login design (US-20 and US-21)

How the phone and the server agree on signing in. The server half is #44, the phone half is #43, and the tables are #127. This file is the contract between them, so each half can be built at the same time.

## How it works

1. The server runs [Better Auth](https://better-auth.com) inside our Express app. Better Auth adds its own routes under `/api/auth`.
2. Signing up or signing in creates a **session** and hands the phone a session cookie.
3. The phone keeps that cookie in SecureStore and sends it with every request to our server.
4. For every other route, the server asks Better Auth whose session the cookie belongs to. With no valid session, it answers `401`, and the phone shows the login screen.

## Decisions

| Decision | Choice |
|---|---|
| Sign-in method | Email and password only |
| Email check (verification link) | None this sprint. Someone can sign up with an address they do not own. |
| Forgot password | None this sprint, since it needs email |
| How the session travels | A cookie (Better Auth's default), not a bearer token |
| How long a session lasts | 30 days, pushed back each day the app is used. An active student is never logged out. |
| Routes open without a session | Only `/api/auth/*` |
| Browser version (US-34) | Keeps working: the server allows Expo Web's address and cookies, in place of `*` |

## Routes

Better Auth's own routes. The bodies and answers below were checked against Better Auth 1.7.21.

| Request | Body | Answer |
|---|---|---|
| `POST /api/auth/sign-up/email` | `{ "name", "email", "password" }` | `200` with `{ token, user }` and the cookie |
| | email already used | `422` |
| | password under 8 characters | `400` |
| `POST /api/auth/sign-in/email` | `{ "email", "password" }` | `200` and the cookie |
| | wrong email or password | `401` |
| `POST /api/auth/sign-out` | `{}` | `200` with `{ "success": true }`; the session ends |
| `GET /api/auth/get-session` | | `200` with `{ session, user }`, or `200` with `null` when signed out |

Errors from these routes look like `{ "message": "Invalid email or password", "code": "INVALID_EMAIL_OR_PASSWORD" }`. Show `message` to the student.

**Every other route** (`/semester`, `/courses`, `/tasks`, `/reviews`, `/syllabus/...`) needs a session. Without one it answers `401` with our usual error shape, `{ "error": "..." }`.

## Phone side (#43)

- The app's link scheme is `crunchweek` (already in `client/app.json`).
- Set up the client with `createAuthClient` from `better-auth/react` and the Expo plugin:

```ts
import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';

export const authClient = createAuthClient({
  baseURL: '<the server address from resolveBaseUrl>',
  plugins: [expoClient({ scheme: 'crunchweek', storagePrefix: 'crunchweek', storage: SecureStore })],
});
```

- Sign in with `authClient.signIn.email({ email, password })` and sign up with `authClient.signUp.email({ name, email, password })`.
- Our own requests send the cookie by hand, with `credentials: 'omit'` so the phone does not add one of its own. `getCookie()` returns a promise (checked against Better Auth 1.7.21), so await it:

```ts
fetch(url, { headers: { Cookie: await authClient.getCookie() }, credentials: 'omit' });
```

- A `401` from any of our routes sends the student to the login screen.

## Server side (#44)

- `server/src/auth.ts` sets up Better Auth. `server/src/app.ts` mounts it above `express.json()`, because Better Auth reads the request body itself.
- With `DATABASE_URL` set, accounts are saved in Supabase's Postgres. Without it, they are kept in memory, so anyone can run the server with no setup (accounts disappear on restart).

## Tables (#127)

- Better Auth needs four tables: `user`, `session`, `account` and `verification`. Its command line tool writes the SQL for them: `npx auth@latest generate`.
- `enrollments.user_id` is `text` and points at `user.id`, which is text like our other ids.

## Secrets

New names in `server/.env` (and in `server/.env.example`, without values):

| Name | What it is |
|---|---|
| `DATABASE_URL` | Supabase's Postgres connection string (Dashboard > Connect). Separate from the Supabase API key. |
| `BETTER_AUTH_SECRET` | A long random string that signs the sessions |
| `BETTER_AUTH_URL` | The server's own address, for example `http://localhost:3000` |
| `CLIENT_ORIGIN` | Expo Web's address, for the browser version. Default `http://localhost:8081`. |
