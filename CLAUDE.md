# SafeHaven — Agent Guide

Flood-shelter & relief resource management platform. **Current phase: complete LOCAL prototype** (pre-AWS).

## Read first
- `docs/IMPLEMENTATION_PLAN.md` holds the full plan, API table, schema changes and phase list. Its **Progress** table at the top is the tracker: set your phase to `in progress` when you start, and to `done` only when the phase's backend, DB and UI all work and tsc/tests/build pass. Record deviations and known limitations in the Notes column.
- Docs in `docs/` (`api.md`, `database.md`, `architecture.md`, `aws-migration.md`) must stay in sync with the code.

## Hard rules
1. **No fake UI.** Every button or form calls a real API → controller → service → Prisma/PostgreSQL → returns updated data → the UI refreshes. It must have validation and show error feedback (toasts, not `alert()`).
2. **The stack is fixed.**
   - Frontend: React 19 + Vite + TypeScript + Tailwind 4 + React Router 7 + Leaflet.
   - Backend: Node + Express + TypeScript + Prisma + PostgreSQL.
   - Only small libraries may be added: `zod` (backend validation), `vitest` (frontend tests). No chart library; charts are SVG/CSS.
3. **No AWS code yet** (no Cognito/Lambda/SNS/S3/etc.). Put replaceable seams in `backend/src/integrations/` (NotificationPublisher, AuditSink, ReceiptStorage, scheduler) and keep `x-user-id` auth isolated in `auth.middleware.ts`.
4. **Auth is demo auth.** The `x-user-id` header names a local user; roles are ADMIN / COORDINATOR / VOLUNTEER, and unauthenticated means public. Coordinators may only touch shelters where `shelter.coordinatorId === user.id` (use `utils/access.ts`). Approvers are always `req.user.id`, never the requester.
5. **Privacy.** Occupant names, contacts and medical data are never returned by public endpoints. Public reunification search never returns contact info.
6. **Integrity.** Check-in, checkout, confirm, resource changes, transfer state changes and donation acceptance run in `prisma.$transaction` with guarded updates. Quantities and occupancy can never go negative. Every important mutation writes an `AuditLog` row and calls `AlertService.evaluateShelter`. There is only one alert path, `alert.service.ts`, which dedupes on `dedupeKey`.
7. **No fake real-time.** Use Refresh buttons and polling, and wording like "Current status as of …".
8. **Schema changes go through Prisma migrations** (`npx prisma migrate dev --name <name>`), never `db push`.

## Databases
- Dev: `safehaven` (from `backend/.env`). Seed it with `npx prisma db seed` (Chennai data, English + Tamil).
- Tests: `safehaven_test` (from `backend/.env.test`). **Tests must never touch the dev DB.**
- Do not weaken or edit `backend/src/tests/integration.test.ts` (the original 12 tests). Add new test files alongside it.

## Commands
- Backend (`backend/`): `npm run dev` (port 5000) · `npx tsc --noEmit` · `npm run test` (jest, run in band)
- Frontend (`frontend/`): `npm run dev` (port 5173) · `npx tsc -b` · `npm run build` · `npm run test` (vitest)

## Git
Local repo only, with no remote. Make one commit per completed phase. Never commit `.env` files or `pg.zip`.
