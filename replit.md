# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express 5 API + WebSocket signaling server (ws)
│   └── mobile/             # Expo React Native app (VIBE social app)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/
└── pnpm-workspace.yaml
```

## VIBE App Features
- **Auth**: 6-step onboarding (name/age/gender → voivodeship/city → username → bio → photo/interests → password), persisted via AsyncStorage
- **Gender**: male/female/other — selected during registration, used for filtering in swipe and omegle
- **Location**: 16 voivodeships with 10 cities each — selected during registration (voivodeship→city picker)
- **Swipe**: Unlimited swipes with PanResponder + Reanimated animations + paid boosts + filter bar (gender free, location premium-only)
- **Boosts**: Spotlight (5min first in swipe, 4.99zł), Attention (notification to chosen user, 4.99zł), Super Like (special like with animation, 2.99zł), Incognito (15min anonymous browsing, 3.99zł), Mega Boost (30min top + highlighted, 9.99zł)
- **Likes tab**: Blurred for free users, paywall to unlock
- **Messages tab**: Matches list with blur paywall for free users  
- **Swipe Messages**: When swiping right, user can optionally send one message. Recipient sees it in matches tab — but can only view content/reply if mutual match or premium
- **Chat screen**: Full real-time chat (polling every 4s) with premium paywall
- **Video tab**: Omegle-like WebRTC video chat with filters (age range, city, gender) — web only
- **Profile tab**: Full editing (name/age/city/bio/interests) + DEV buttons
- **Premium**: Modal paywall at 24,99 PLN/week (simulated)
- **Design**: Dark #000000, neon yellow #CCFF00, Montserrat font

## WebSocket Signaling Server
- Path: `/api/ws` (accessible via `wss://domain/api/ws`)
- Handles WebRTC peer matching with age/city filters for Omegle video chat
- Relays offer/answer/ICE candidates between matched peers (with ICE candidate buffering)
- Live streaming: host→viewer WebRTC with multi-viewer fan-out
- Stage feature: host can invite viewers to stream alongside them (co-host)
- Co-host distribution: when co-host joins, host fans out co-host stream to all viewers via separate PCs
- Message types: join, next, offer, answer, ice-candidate, join-live, live-offer, live-answer, live-ice, invite-to-stage, stage-offer, stage-answer, stage-ice, stage-leave, cohost-offer, cohost-answer, cohost-ice

## WebRTC Known Fixes Applied
- **ICE candidate buffering**: Candidates are queued when remote description not yet set, flushed after setRemoteDescription — fixes grey screen and Omegle not connecting
- **Omegle race condition**: Non-initiator no longer creates PC on `matched`; only creates PC lazily when `offer` arrives, preventing duplicate PeerConnections
- **Live stream grey screen**: Fixed by ICE buffering; viewer PC is reused on renegotiation offers (not recreated)

## DB Tables
- `users`: id, name, age, bio, photo_url, is_premium, city, interests[]
- `likes`: from_user_id, to_user_id, action (like/dislike)
- `matches`: user1_id, user2_id (created on mutual like)
- `messages`: sender_id, receiver_id, content, is_read

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
