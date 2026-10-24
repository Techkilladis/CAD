# SafeHaven — Implementation Plan (Full Local Prototype)

> Source of truth for the current development phase. Every agent working on this repo must read this file and `CLAUDE.md` first, then update the **Progress** section below before handing back.

## Progress

| Phase | Scope | Status | Notes / deviations / limitations |
|---|---|---|---|
| 0 | Plan in repo, CLAUDE.md, git init, Postgres + `safehaven_test` DB | done | `backend/.env.test` points at `safehaven_test` (gitignored). psql: `C:\Program Files\PostgreSQL\18\bin\psql.exe`. Dev DB creds in `backend/.env`. |
| A | Schema + migration, infra (errors/validation/access/audit), shelters, check-in/out/register, resources + ledger, UI kit, layouts, nav, admin shelters/occupancy/resources, coordinator overview/occupants/resources, public finder/detail/register | done | Backend: 47 jest tests pass (original 12 untouched). Frontend: tsc + build clean, flows verified in browser (finder, coordinator confirm, admin resources). Seed rewritten early (Chennai, all entities, alerts via real engine) - Phase F only needs verification. Legacy volunteer/reunification pages still use `api/legacy.ts` + `alert()` until phases C/D. Frontend `npm run test` (vitest) arrives in phase E. Translations editor UI arrives in D (API + public switcher already work). |
| B | Transfer workflow, alert engine + scheduler + run-check, admin/coordinator transfers & alerts, admin overview | done | 70 backend jest tests pass (original 12 untouched). Transfer semantics: PENDING reserves logically only (available = qty - pending outgoing); approve deducts source (TRANSFER_OUT); receive adds destination (TRANSFER_IN, resource auto-created); cancel after approval restores source (TRANSFER_RETURN, admin only); all guarded updateMany in a transaction. Admin cannot approve a transfer they requested. TRANSFER_REQUIRED alert is evaluated only when a shelter is re-evaluated (any mutation there, run-check or scheduler). Scheduler: ALERT_SCAN_INTERVAL_MS env, never in test, single-start, non-overlapping. Public GET /alerts shows only active FULL/OVERCROWDING notices (no message). Limitation: unit for auto-created destination resource copies the source unit. |
| C | Volunteers (all roles), medical priority views, donations | not started | |
| D | Reunification (public + staff), translations + language switcher, emergency page | not started | |
| E | Offline check-in queue + idempotent sync, audit viewer, reports/dashboard + charts, users admin, settings | not started | |
| F | Seed rewrite (Chennai), docs, UX consistency pass, full validation + 31-step demo walkthrough | not started | |

Status values: `not started` · `in progress` · `done` (only when backend + DB + UI work and tsc/tests/build pass) · `blocked`.

---


## Context
The SafeHaven prototype (at `C:\Users\suriy\OneDrive\Desktop\VS CODE\Safehaven`, **not** this session's working directory, which is an unrelated Flask repo that won't be touched) only goes partway. The schema already declares most entities, but large parts have no API, no UI, or neither. The Admin page is mostly read-only and the Coordinator page shows only a sliver of what it should. The goal is to make every P0/P1/P2 feature work end-to-end (UI → route → controller → service → Prisma/PostgreSQL → refreshed UI) before the AWS migration. The stack stays as it is, with no AWS code, and every local implementation sits behind a seam that an AWS service can replace later.

Decisions you made: seed data moves to **Chennai** (English + Tamil). Switch to **Prisma migrations**: one-time `migrate reset` of the dev DB, then re-seed, and tests move to a separate `safehaven_test` DB. Run **`git init` locally** with one commit per phase and no remote.

## Audit findings (what exists today)
**Schema** (`backend/prisma/schema.prisma`) already has: User, Shelter, Resource, Checkin (with medical flags and PENDING/CONFIRMED/CHECKED_OUT), Transfer (all 6 statuses), AlertLog, VolunteerShift/Assignment, Donation, ReunificationCase, AuditLog. It has no migrations folder.

**Working:** shelter list/nearest (Haversine `utils/haversine.ts`), create/update shelter, coordinator check-in/out with transactions, public `register` → `confirmCheckin`, transfer create/approve (deducts the source) → transit → receive (adds to the destination), alert `run-check` with basic dedupe, shift create/signup with overlap check, reunification report/list/status. There are 12 jest tests in `src/tests/integration.test.ts`.

**Missing entirely:** donations API, audit logging (the model exists but nothing writes to it), `GET /alerts`, `/auth/me`, user admin, dashboard sub-endpoints, translations, offline queue, any coordinator-scoped list endpoints.

**Bugs and security gaps to fix:**
- Public `GET /shelters/:id` returns active check-ins, including names and medical data, to anyone.
- Public `POST /reunification` returns matching check-in records to anonymous users.
- `/auth/users` is public and returns emails. The `LandingPage` calls the admin-only `/dashboard`, so it fails for the public.
- Checkout trusts the `familySize` sent by the client, doesn't check that the check-in belongs to the shelter, and allows double checkout.
- `updateResource` accepts negative quantities, doesn't check that the resource belongs to the shelter, and creates a duplicate LOW_STOCK alert on every update. LOW_STOCK dedupe is per shelter rather than per resource, so a second low resource never alerts.
- Check-in creates OVERCROWDING/FULL alerts inline with no dedupe, separately from `AlertService`, which makes two alert paths.
- Transfers: a coordinator can name any `fromShelterId`. Reject skips the status check. Transit/receive skip ownership. There's no cancel, and `GET /transfers` is unscoped.
- Shift creation isn't scoped to the coordinator's own shelter. Alert acknowledge isn't scoped.
- `public/sw.js` pre-caches a missing `/manifest.json`, so install fails. It also caches authenticated `/api` GETs across users.
- Tests wipe the dev database. In the seed, an admin is coordinator of a shelter.

## Architecture conventions (applied everywhere)
- **Errors:** add `utils/httpError.ts` (`HttpError(status, message, details?)`). Extend `error.middleware.ts` to map HttpError, ZodError → 400 and Prisma P2025 → 404, P2002 → 409. Controllers become thin `asyncHandler` wrappers. Existing error strings stay exactly as they are (tests assert them).
- **Validation:** add `zod` (backend only). Each route module gets a `*.schemas.ts` with request schemas.
- **Authorization:** add `middleware/auth.middleware.ts` + `optionalAuth` (attaches the user if the header is present) and rejects inactive users. Add `utils/access.ts` with `getManagedShelterIds(user)`, `assertShelterAccess(user, shelterId)` (admin = all, coordinator = shelters where `coordinatorId = user.id`) and `scopeShelterFilter(user)` for list queries.
- **AWS seams** (interfaces in `src/integrations/`):
  - `NotificationPublisher` (local: console + `notifiedVia='LOCAL'`) → SNS/SES
  - `AuditSink` (Postgres) → CloudWatch
  - `ReceiptStorage` (reference string) → S3
  - `TransferWorkflow` (synchronous state machine in `transfer.service`) → Step Functions
  - `alertScheduler` (setInterval) → EventBridge
  - `x-user-id` auth stays isolated in the middleware for Cognito.
- **Transactions:** every check-in, checkout, confirm, resource adjustment, transfer state change and donation acceptance runs in `prisma.$transaction`. Inside it: conditional updates (`updateMany` with a `where` guard on status/quantity, then assert `count === 1`) to block races and double actions, an audit write, and `AlertService.evaluateShelter(tx, shelterId)`.

## Database changes (one migration: `full_local_prototype`)
**New enums:** `MedicalPriority {NONE, LOW, MEDIUM, HIGH, CRITICAL}`, `CheckinSource {COORDINATOR, PUBLIC_REGISTRATION, OFFLINE_SYNC}`, `AlertSeverity {INFO, WARNING, CRITICAL}`, `StockMovementType {SET, ADJUSTMENT, TRANSFER_OUT, TRANSFER_IN, TRANSFER_RETURN, DONATION}`, `DonationStatus {PENDING, ACCEPTED, REJECTED}`, `ShiftStatus {OPEN, CANCELLED}`. `CheckinStatus` gains `CANCELLED` (rejected registration). `ShelterStatus` keeps ACTIVE/INACTIVE/FULL/EMERGENCY_CLOSED (soft deactivation; nothing is hard-deleted).

**Model extensions:**
- **User:** `isActive`, `skills?`, `languages?`. Relations for the new FKs below.
- **Shelter:** `medicalSupport Bool`, `contactPhone?`/`contactEmail?` (keep `contactInfo`), drop `supportedLanguages` (now derived from translations), relation `translations`. Index on `status`, `coordinatorId`.
- **Resource:** `isActive`, `createdAt`. Index `shelterId`.
- **Checkin:** `phone?`, `criticalMedical Bool`, `medicalNotes?`, `priority MedicalPriority` (computed on write by `utils/medicalPriority.ts`), `source`, `clientRequestId String? @unique` (offline idempotency), `referenceCode String? @unique` (public registration code), `checkedInById?`, `checkedOutById?`, `confirmedAt?`, `createdAt`. Indexes `(shelterId, status)`, `priority`.
- **Transfer:** `reason?`, `rejectionReason?`, `approvedAt?`, `shippedAt?`, `receivedAt?`, `receivedById?`, `cancelledAt?`, `cancelledById?`. Indexes on status, from, to.
- **AlertLog:** `severity`, `resourceType?`, `dedupeKey` (e.g. `LOW_STOCK:<shelter>:MEDICINE`), `acknowledgedById?/At?`, `resolvedById?/At?`. Index `(dedupeKey, status)`, `(shelterId, status)`. Keep the `acknowledged` column for compatibility.
- **VolunteerShift:** `title`, `task?`, `notes?`, `status ShiftStatus`, `createdById?`.
- **Donation:** `status`, `inventoryApplied Bool`, `recordedById?`, `acceptedById?`, `acceptedAt?`, `receiptUrl?` (future S3 key). Index `shelterId`, `receivedDate`.
- **ReunificationCase:** `lastKnownShelterId?` (FK), `reportedById?`, `matchedCheckinId?` (FK), `staffNotes?`. Index `status`, `missingPersonName`.
- **AuditLog:** index `(entity, entityId)`, `timestamp`. Change `metadata` to `Json?`.

**New models:**
- `ShelterTranslation {id, shelterId (cascade), locale, name?, description?, instructions?, @@unique([shelterId, locale])}`. This is the multilingual data. Locales are data, not columns.
- `StockMovement {id, resourceId (cascade), shelterId, type, delta, quantityAfter, note?, userId?, referenceId? (transfer/donation id), createdAt}`. This is the inventory ledger.
- `SystemSetting {key @id, value, updatedAt, updatedById?}`. Holds alert thresholds (overcrowding 0.9, critical medical count, transfer surplus multiplier, scan interval) used by the alert engine and edited in Admin → Settings.

FKs from new tables cascade or `SetNull` so the existing test's `deleteMany` order still works unchanged.

## Backend API (prefix `/api`)
Existing paths are kept where they already match. The existing `/volunteers` POST-creates-shift is restructured under `/volunteers/shifts`.

| Area | Endpoints (auth) |
|---|---|
| Auth/Users | `GET /auth/users` (public demo picker: id, name, role only) · `GET /auth/me` (user + managed shelters) · `PATCH /auth/me` (name/phone/skills/languages) · `GET/POST /users`, `PATCH /users/:id` (role, isActive, details) — admin |
| Shelters | `GET /shelters?q=&minAvailable=&resource=&status=&includeInactive=` (public-safe view) · `GET /shelters/nearest?latitude=&longitude=&onlyAvailable=&limit=` · `GET /shelters/:id?lang=` (public-safe: capacity, status, resource *status levels*, medicalSupport, languages, contact, translation) · `GET /shelters/:id/overview` (staff ops view: occupants, medical, alerts, transfers in/out, shifts, donations) · `POST /shelters`, `PATCH /shelters/:id` (admin all fields; coordinator: description/contact/medicalSupport/status ACTIVE↔FULL only) · `PATCH /shelters/:id/status` (admin) · `PUT /shelters/:id/translations/:locale` (owner/admin) · `GET /shelters/stats/public` |
| Check-ins | `POST /shelters/:id/register` (public → PENDING + referenceCode, rate of fields limited) · `POST /shelters/:id/checkin` (coordinator/admin; accepts `clientRequestId`; replay → 200 `{duplicate:true}`) · `PATCH /shelters/:id/checkin/:checkinId/confirm` · `PATCH .../reject` · `POST /shelters/:id/checkout` (uses the stored familySize; rejects if not CONFIRMED) · `GET /shelters/:id/checkins?status=&priority=&q=` |
| Resources | `GET /shelters/:id/resources` (public: type + stock status; staff: full) · `POST /shelters/:id/resources` · `PATCH /shelters/:id/resources/:resourceId` (`quantity` set **or** `delta` adjust, `lowStockThreshold`, `unit`, `isActive`, `note`; negative → 400) · `GET /shelters/:id/resources/movements` |
| Transfers | `POST /transfers` (coordinator: own shelter must be source or destination, so both "request from" and "send to" work; validates available = qty − pending outgoing) · `GET /transfers?status=&shelterId=&direction=` (scoped) · `GET /transfers/:id` · `PATCH /:id/approve` (admin; `approvedById = req.user.id`; deducts source, writes TRANSFER_OUT) · `/reject` (admin, PENDING only, reason) · `/transit` (source owner/admin) · `/received` (+ keep `/receive` alias; destination owner/admin; adds to destination) · `/cancel` (requester while PENDING; admin until received; restores source if already deducted) |
| Alerts | `GET /alerts?status=&type=&shelterId=` (no auth: only active FULL/OVERCROWDING/closure notices; coordinator: own; admin: all) · `PATCH /:id/acknowledge`, `/:id/resolve` (scoped) · `POST /alerts/run-check` (admin) |
| Volunteers | `GET /volunteers` (volunteer users; admin/coordinator) · `GET /volunteers/shifts?shelterId=&upcoming=` · `POST /volunteers/shifts` (coordinator: own shelter) · `PATCH /volunteers/shifts/:shiftId` (edit/cancel) · `POST`/`DELETE /volunteers/shifts/:shiftId/signup` (volunteer; full/overlap/started checks) · `GET /volunteers/me/shifts` |
| Donations | `GET /donations?shelterId=&resourceType=&from=&to=` (scoped) · `POST /donations` (`applyToInventory` flag) · `PATCH /donations/:id` (edit notes/receipt; `status: ACCEPTED` applies inventory once, guarded by `inventoryApplied`) |
| Reunification | `POST /reunification` (public; returns case id + status only, no match data) · `GET /reunification/public-search?q=` (≥2 chars; name/age/status/shelter name only, no contacts) · `GET /reunification?q=&status=` (staff; full + candidate check-in matches) · `PATCH /reunification/:id` (status, notes, matchedCheckinId; keep `/:id/status`) |
| Dashboard/Reports | `GET /dashboard` (admin overview; kept for compatibility) · `/dashboard/district` · `/dashboard/resources` · `/dashboard/medical` · `/dashboard/volunteers` · `/dashboard/donations` · `/dashboard/reports` (one aggregate payload). All accept `?shelterId`. Coordinators are auto-scoped to their own shelters; volunteers/public get 403 |
| Audit/Settings | `GET /audit?entity=&userId=&page=` (admin) · `GET/PATCH /settings` (admin) |

**Services** (`src/services/`): extend `shelter`, `transfer`, `alert`, `volunteer`, `reunification`. Add `checkin.service` (split out of shelter.service), `resource.service`, `donation.service`, `dashboard.service` (moves aggregation out of `dashboard.controller.ts`), `user.service`, `audit.service`, `settings.service`. Shared `utils/stockStatus.ts` (EMPTY = 0, CRITICAL ≤ ½ threshold, LOW ≤ threshold, else HEALTHY) and `utils/medicalPriority.ts` (critical → CRITICAL; pregnant/disabled/medicalFlag → HIGH; elderly → MEDIUM; children → LOW).

**Alert engine** (`alert.service.ts`, the only alert path): `evaluateShelter(tx, shelterId)` computes the set of current conditions:
- OVERCROWDING at ≥ setting; FULL_SHELTER at ≥ 100% (also sets status FULL, and back to ACTIVE when space frees up)
- LOW_STOCK per resource
- CRITICAL_MEDICAL_NEED on any active critical case, or a count ≥ setting
- TRANSFER_REQUIRED when a resource is low and another active shelter holds a surplus (message names the suggested source)

It creates alerts only if no ACTIVE/ACKNOWLEDGED alert exists with the same `dedupeKey`. It auto-resolves alerts whose condition has cleared, and publishes new alerts via `NotificationPublisher`. `runGlobalCheck()` loops over shelters and returns `{created, resolved, scanned}`. `server.ts` starts `alertScheduler` when `ALERT_SCAN_INTERVAL_MS` is set and `NODE_ENV !== 'test'`.

## Frontend (keep React 19 / Vite / Tailwind 4 / Router 7 / Leaflet)
- **API layer:** `src/api/client.ts` (axios + `getErrorMessage`), `src/api/types.ts` (typed models/enums replacing `any`), domain modules `shelters.ts, checkins.ts, resources.ts, transfers.ts, alerts.ts, volunteers.ts, donations.ts, reunification.ts, dashboard.ts, users.ts, settings.ts, audit.ts`.
- **Auth:** `AuthContext` refreshes from `/auth/me` on load (gets managed shelters). `ProtectedRoute` is unchanged in concept. The navigation config is role-driven: one `nav.ts` map from role to items, so only items the role can access are rendered.
- **UI kit** (`src/components/ui/`): Button, Card, KpiCard, StatusBadge (one mapping for shelter/stock/transfer/alert/priority/case statuses), DataTable (sortable + pagination), Tabs, Modal/Drawer, ConfirmDialog (for destructive actions), FormField/inputs, SearchInput, EmptyState, Spinner, `ToastProvider` (replaces every `alert()`), `RefreshBar` ("Current status as of 14:32 · Refresh", optional 30 s polling via a `usePolling` hook). It doesn't claim real-time anywhere.
- **Layouts:** `PublicLayout` (top nav: Home, Find Shelter, Emergency Info, Login) and `ConsoleLayout` (sidebar + mobile drawer, role nav, user menu).
- **Shared feature components** (`src/features/…`), reused by both the admin and coordinator views: `ShelterMap` (Leaflet CircleMarkers coloured Available/Critical/Full from DB coordinates, with legend; reused publicly), `ShelterForm`, `ResourceTable` (inline set/adjust/threshold, stock badges, movement history drawer), `TransferForm`/`TransferTable` (actions shown per status and role), `AlertList` (filters, ack/resolve), `CheckinForm` (shows live "occupancy after check-in: 182/200", blocks over-capacity), `OccupantTable` (checkout with confirm), `PendingRegistrations`, `MedicalPriorityList`, `ShiftForm`/`ShiftTable`, `DonationForm`/`DonationTable`, `ReunificationBoard` (search, filters, status update, match linking), `BarChart`/`StackedBar`/`Donut` (plain SVG/CSS, no chart library), `TranslationEditor`.
- **Routes:**
  - Public: `/`, `/shelters` (search, filters: has space / has resource / status, list + map, "Use my location" with denied/unavailable/none-available states, "2.4 km away"), `/shelters/:id` (detail + EN/தமிழ் switcher + "Register family" → `/shelters/:id/register` → shows reference code), `/emergency` (emergency info + report a missing person + limited public search), `/login`.
  - Admin `/admin/*`: overview (KPIs + map + top alerts + pending transfers + Run Alert Check), shelters (table + create/edit drawer + activate/deactivate with confirm), shelters/:id (full detail tabs from spec §7), occupancy (district totals + map + per-shelter bars + critical/full lists), resources (district matrix shelter×type + summaries + edit), transfers (status tabs + full workflow), alerts, volunteers (district shifts + coverage), reunification, medical (district priority cases), donations (+ report), reports (charts for every metric in §29), users (create, role, activate), audit (log viewer), settings (alert thresholds + integration status showing the local implementations).
  - Coordinator `/coordinator/*`: overview (§12 KPIs), occupants (tabs: Active/checkout · New check-in · Pending registrations · Offline queue), resources, transfers (Outgoing/Incoming × status, create request), volunteers (create shift, assigned volunteers), donations, medical, alerts, reports (own shelter), shelter (settings + translations). There's a shelter selector if a coordinator manages more than one.
  - Volunteer `/volunteer/*`: shifts (available, filter by shelter), my-shifts (cancel upcoming), profile (`PATCH /auth/me`).
- **Multilingual:** the public shelter detail and finder show `translation[lang] ?? base` fields. A language toggle (persisted in localStorage) lists the locales that exist for the shelter. Only shelter information is translated, plus a small label dictionary for that panel.
- **Offline check-in** (`src/offline/checkinQueue.ts`, storage injected; localStorage in the app, in-memory in tests):
  - Every queued item gets a `clientRequestId = crypto.randomUUID()`.
  - Statuses: `PENDING_SYNC → SYNCING → SYNCED | FAILED(reason)`.
  - Sync is triggered by the `online` event, on mount, and by a "Sync now" button. A single-flight lock plus server-side `clientRequestId` uniqueness prevents duplicates. FAILED items (e.g. capacity) can be retried or discarded.
  - The coordinator UI shows an "Offline · N pending sync" banner. A check-in is queued when `navigator.onLine` is false or axios gets no response. A clearly labelled "Simulate offline (demo)" toggle lets the demo run without DevTools.
  - The last-loaded shelter overview is cached for offline display with a staleness timestamp.
  - `sw.js` is fixed to cache the app shell only (no `/api` caching, no missing manifest) and is registered only in production builds.

## Seed (`prisma/seed.ts`, rewritten; Chennai)
- 6 shelters around Velachery, Tambaram, Mudichur, Adyar, T. Nagar and Perungudi, with real-ish coordinates and varied capacity/occupancy: one ~45% (healthy), one ~92% (overcrowding), one 100% (FULL), one low on medicine (feeds the demo's "Shelter A/B"), one INACTIVE, one EMERGENCY_CLOSED. Each has `medicalSupport`, contacts, and `en` + `ta` translations.
- Users: 2 admins, 3 coordinators (each mapped to real shelters, no admin coordinators), 3 volunteers.
- About 25 families with mixed sizes and medical flags; `capacityOccupied` is computed from confirmed check-ins so the numbers are consistent. 3 pending public registrations.
- All 4 resources per shelter at varied levels, with StockMovement history.
- Transfers in every status, with correct requester/approver.
- Shifts (past, upcoming, full, open) with assignments, including one volunteer near-overlap.
- 8 donations (accepted/pending).
- 6 reunification cases across all statuses.
- Alerts generated by running the real `AlertService.runGlobalCheck()` at the end, plus a few historical resolved/acknowledged ones.
- Audit entries for seeded operations.

## Testing
- **Backend:** add `.env.test` (`safehaven_test`). Jest `globalSetup` runs `prisma migrate reset --force --skip-seed` against it. `setupFiles` loads `.env.test`. Run `--runInBand`.
- Shared `tests/helpers.ts` (factories, `resetDb` via TRUNCATE CASCADE, `as(user)` request helper).
- The existing `integration.test.ts` stays **unchanged** and must still pass.
- New files cover every item in the spec's §37 list: `auth`, `shelters`, `capacity`, `resources`, `transfers` (request/approve/reject/cancel/receive, inventory consistency, requester ≠ approver, coordinator can't approve, coordinator can't use foreign shelter as source), `alerts` (low-stock, overcrowding, full, duplicate prevention, auto-resolve, ack scoping, run-check), `volunteers` (create/scope/signup/full/overlap/cancel), `donations` (create, apply-to-inventory once), `reunification` (create, public search hides contacts, staff search, status update), `medical` (priority computation, district summary, public/volunteer can't read medical), `public` (search, filters, nearest + onlyAvailable, no occupant leakage), `offline-sync` (same `clientRequestId` twice → one check-in, occupancy incremented once), `audit`.
- **Frontend:** add `vitest` (dev) with `src/offline/checkinQueue.test.ts`, covering enqueue, sync success, failure marking, single-flight/no duplicate submit, and idempotent replay. Script `npm run test`.

## Who builds it: Sonnet subagents (your request)
- Each phase below runs as its own `Agent` call with `model: "sonnet"` (general-purpose). The prompt for each one includes this plan file's path, the phase's scope, the audit findings that apply, and the project path `C:\Users\suriy\OneDrive\Desktop\VS CODE\Safehaven`.
- Phases run **one after another**, never in parallel, because they all touch the schema, the API client and shared components.
- After each phase I (Opus) review the diff and run `npx tsc`, the tests and the build myself. I send the same agent corrections via SendMessage if anything fails or is mocked. Only then do I make the phase's git commit and start the next phase.
- Each agent must report what it implemented, what it didn't, and its exact command output. I don't take "done" on trust.
- If you'd rather the whole session ran on Sonnet, type `/model sonnet` and I'll build it directly instead.

## Execution order (one local git commit per phase; a phase is claimed only when backend + DB + UI all work)
0. **First action:** copy this plan word for word to `Safehaven/docs/IMPLEMENTATION_PLAN.md`. Add a short `Safehaven/CLAUDE.md` that points every future agent to it, states the stack and AWS-free constraints, the "no fake UI" rule, the test DB rule, and where the phase progress is tracked. Keep a **Progress** checklist at the top of `IMPLEMENTATION_PLAN.md`; each agent ticks its phase and notes deviations or limitations there before handing back. Then `git init` with `.gitignore` (`.env`, `node_modules`, `dist`, `pg.zip`). Confirm Postgres is reachable. Create `safehaven_test`.
1. **A:** schema + migration (`migrate reset` then `migrate dev --name full_local_prototype`), error/validation/access/audit infrastructure, shelters CRUD/status/overview, check-in/out/register/confirm, resources + ledger, UI kit, layouts, nav, admin shelters/occupancy/resources, coordinator overview/occupants/resources, public finder/detail/register. Tests for these.
2. **B:** transfer workflow, alert engine + scheduler + run-check, admin transfers/alerts/overview, coordinator transfers/alerts. Tests.
3. **C:** volunteers (all 3 roles), medical priority views, donations. Tests.
4. **D:** reunification (public + staff), translations + language switcher, emergency page. Tests.
5. **E:** offline queue + sync + idempotent endpoint, audit viewer, reports/dashboard endpoints + charts, users admin, settings. Tests (backend + vitest).
6. **F:** seed rewrite, update `docs/api.md`, `database.md`, `architecture.md`, `aws-migration.md` (local → AWS seam map), README; UX consistency pass; full validation and walkthrough.

## Verification
- `backend: npx tsc --noEmit`, `npm run test`
- `frontend: npx tsc -b`, `npm run build`, `npm run test`
- `npx prisma migrate status` is clean
- Manual run: `npx prisma db seed`, start backend + frontend, then drive the full 31-step demo scenario in the browser with Playwright MCP, switching demo users via the login picker. Check DB state after the key steps (occupancy, inventory before/after approve/receive, alert rows, donation inventory delta, synced check-in count = 1).
- Final report covers all 25 items requested, with an explicit list of anything still placeholder. Expected limitations to state honestly:
  - receipts are a reference string, not a file upload
  - notifications are console/DB only
  - polling instead of push
  - demo auth with no passwords
  - offline only covers check-in, and only while the app is already loaded
  - translations cover shelter info only
