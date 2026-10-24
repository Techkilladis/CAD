# Architecture

## Local prototype

```
Browser (React 19 + Vite + Tailwind 4 + Router 7 + Leaflet)
   │  Axios, x-user-id header (demo auth)
   ▼
Express + TypeScript  :5000
   routes → controllers (thin, zod-validated) → services → Prisma → PostgreSQL
   │
   └── integrations/  (replaceable seams)
```

### Backend layering
- **routes/** wire paths, `requireAuth` / `optionalAuth` / `requireRole`.
- **controllers/** parse input with zod (`schemas/`) and call one service method (`asyncHandler`).
- **services/** hold all business rules and transactions. `AlertService.evaluateShelter(tx, shelterId)` is the **only** alert path.
- **utils/access.ts** is the single place that decides shelter ownership (`getManagedShelterIds`, `assertShelterAccess`, `scopeShelterFilter`).
- **middleware/error.middleware.ts** maps `HttpError`, zod errors and Prisma `P2025/P2002/P2003` to 404/400/409.
- **auth.middleware.ts** is the only file that reads `x-user-id`.

### Integration seams (`backend/src/integrations/`)
| Seam | Local implementation | AWS replacement |
|---|---|---|
| `NotificationPublisher` | console log, `notifiedVia = LOCAL` | SNS / SES |
| `AuditSink` | PostgreSQL `AuditLog` | CloudWatch Logs |
| `ReceiptStorage` | reference string only | S3 |
| `alertScheduler` | `setInterval`, never in tests, single start, no overlapping scans | EventBridge Scheduler |
| Transfer workflow | synchronous state machine in `transfer.service` | Step Functions |
| Authentication | `x-user-id` header | Cognito JWT |

### Frontend structure
- `api/` typed domain modules over one Axios client (`getErrorMessage`, `getFieldErrors`).
- `components/ui/` design kit (Button, Card, DataTable, Modal/Drawer, ConfirmDialog, Tabs, Toast, RefreshBar, …). Errors are shown as toasts, never `alert()`.
- `layouts/` `PublicLayout` and role-driven `ConsoleLayout`; `nav.ts` is the single role → menu map.
- `features/` components shared by admin and coordinator screens (maps, forms, tables, panels, charts).
- `offline/` the check-in queue (pure TypeScript, injected storage and submitter, unit tested), connectivity hook and overview cache.
- `context/` auth (session verified via `/auth/me`, selected shelter) and language.

### Behaviour principles
- **No fake real-time.** Screens say "Current status as of HH:MM:SS" with a Refresh button; some offer opt-in 30 s polling.
- **Privacy by construction.** Public endpoints use dedicated projections; occupant and medical data exist only on staff endpoints scoped by shelter.
- **Idempotency.** Offline check-ins carry a `clientRequestId`; transfer, donation, checkout and alert actions are guarded so a repeated request cannot double-apply.
- **Service worker** caches the static app shell only (production builds); API responses are never cached.

### Testing
- Backend: jest + supertest against `safehaven_test` (migrated fresh each run); concurrency cases for approvals, donations, sign-ups and offline replays.
- Frontend: vitest for the offline queue (enqueue, sync, failure, single-flight, idempotent replay).
