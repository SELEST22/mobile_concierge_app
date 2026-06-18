# Selest Security — Mobile Concierge Service

A cross-platform concierge & security app for iOS and Android, plus the backend
that powers it. This first phase delivers the **foundation** (project structure,
secure auth) and the complete **mass-communication / broadcast feature**.

## Monorepo layout

```
mobile-concierge/
├── apps/
│   └── mobile/          Expo (React Native) app — one codebase for iOS + Android
├── packages/
│   └── shared/          Shared TypeScript types + typed API client (source of truth)
├── server/              Node + Express + SQLite API (auth, broadcast, concierge)
└── package.json         npm workspaces root
```

The mobile app imports types and the API client from `@concierge/shared`, so the
backend and front end can never drift out of sync. A future web app would reuse
the same package.

## Features in this build

**Mass communication (the broadcast system)**
- Admins compose a broadcast (title, message, **Emergency** or **General**, optional expiry) and send it to every user in one action.
- Users see broadcasts in a **Notifications** inbox; **emergency** messages sort to the top, are highlighted red, and pop up on arrival.
- Messages stay visible for **30 days** by default, then auto-hide.
- **Archive**: moves a message to a dedicated **Archived** section. Archived messages do **not** expire.
- **Delete**: permanently removes a message for that user, with an "**this cannot be reversed**" confirmation.
- **Consent**: users must agree to receive notification pop-ups when creating an account.
- Extras: filter (All / Emergency / General), mark-as-read, mark-all-read, admin delete of any broadcast.

**Foundation**
- Secure JWT auth (passwords hashed with bcrypt; token stored in the device keychain via `expo-secure-store`).
- Role-based access (admin vs guest); admin-only broadcast tab and endpoints.
- A basic **Concierge / Security request** flow (raise a request, see its status) — scaffolding for the next phase (realtime chat, QR).

## Prerequisites

- Node.js 18+ (tested on Node 20)
- The **Expo Go** app on your phone, or an Android/iOS emulator

## 1. Run the backend

```bash
cd server
npm install
cp .env.example .env        # optional; sensible defaults otherwise
npm run seed                # creates demo accounts + sample broadcasts
npm run dev                 # API on http://localhost:4000
```

Demo accounts (from the seed):

| Role  | Email                  | Password   |
|-------|------------------------|------------|
| Admin | `admin@concierge.dev`  | `admin123` |
| Guest | `guest@concierge.dev`  | `guest123` |

## 2. Run the mobile app

```bash
cd apps/mobile
npm install
npm start                   # then scan the QR code with Expo Go
```

The app auto-detects the backend at your computer's LAN IP on port `4000`
(reusing the Expo dev-server host). To override, set `EXPO_PUBLIC_API_URL`, e.g.
`EXPO_PUBLIC_API_URL=http://192.168.1.50:4000 npm start`.

> On a physical device, `localhost` means the phone — make sure the phone and
> computer are on the same Wi-Fi so the LAN IP is reachable.

## API reference

| Method   | Endpoint                          | Who   | Purpose                                  |
|----------|-----------------------------------|-------|------------------------------------------|
| POST     | `/auth/register`                  | any   | Sign up (requires `notificationsConsent`)|
| POST     | `/auth/login`                     | any   | Sign in                                  |
| GET      | `/auth/me`                        | user  | Current user                             |
| POST     | `/broadcast`                      | admin | Send a broadcast to all users            |
| GET      | `/broadcast`                      | admin | List all broadcasts                      |
| DELETE   | `/broadcast/:id`                  | admin | Delete a broadcast                       |
| GET      | `/user/messages`                  | user  | Active inbox                             |
| GET      | `/user/messages?view=archived`    | user  | Archived section                         |
| PATCH    | `/user/messages/:id/archive`      | user  | Archive a message                        |
| PATCH    | `/user/messages/:id/read`         | user  | Mark one read                            |
| PATCH    | `/user/messages/read-all`         | user  | Mark all read                            |
| DELETE   | `/user/messages/:id`              | user  | Permanently delete (per user)            |
| POST     | `/concierge`                      | user  | Raise a concierge/security request       |
| GET      | `/concierge`                      | user  | List my requests                         |

## Data model

- **users** — `notifications_consent` records sign-up agreement.
- **broadcast_messages** — one global row per broadcast (`expires_at` drives the 30-day window). Sending is O(1); there is no per-user fan-out, so there are never duplicates.
- **user_message_status** — each user's `read_at`, `is_archived`, `is_deleted` for a broadcast.
- **concierge_requests** — basic request records.

## Tech choices

- **Expo / React Native** — one codebase ships native iOS + Android and shares logic with a future React web app.
- **Node + Express + SQLite (better-sqlite3)** — zero-config local DB; the data layer is isolated in `server/src/db.ts` so swapping to PostgreSQL later is a contained change.
- **JWT + bcrypt + expo-secure-store** — standard, secure auth with the token encrypted at rest on device.

## Roadmap (next phases)

- Concierge realtime chat + admin handling queue
- QR code interaction system
- Push notifications (FCM/APNs) and emergency sound/vibration
- React web app reusing `@concierge/shared`
