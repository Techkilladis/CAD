# AWS migration map

The local prototype has **no AWS code**. Every replaceable concern sits behind a seam so migration swaps an implementation instead of rewriting features.

| Concern | Local today | Seam / file | AWS target | Migration notes |
|---|---|---|---|---|
| Frontend hosting | Vite dev server | — | S3 + CloudFront | `npm run build` output; set `VITE_API_URL`. SPA fallback to `index.html` |
| API | Express on :5000 | `app.ts` (`createApp`, no side effects) + `server.ts` (listen, scheduler, shutdown) | Lambda + API Gateway (or ECS/App Runner) | Containers run `server.ts` as-is; for Lambda, wrap `createApp(loadEnv())` with an adapter and skip `server.ts`. Connection pooling (RDS Proxy) needed for Prisma on Lambda |
| Database | PostgreSQL | `prisma/schema.prisma`, migrations | RDS / Aurora PostgreSQL | `prisma migrate deploy`; no schema change required |
| Authentication | `x-user-id` demo header | `middleware/auth.middleware.ts` | Cognito user pool + JWT | Replace `loadUser`; map `User.cognitoSub` (column already exists); roles → Cognito groups. Routes/services unchanged |
| Notifications | console + `notifiedVia='LOCAL'` | `integrations/NotificationPublisher.ts` | SNS topics (SMS/e-mail/push) or SES | Implement `publish(event)` and return the channel label |
| Audit trail | PostgreSQL `AuditLog` | `integrations/AuditSink.ts` | CloudWatch Logs (keep Postgres for the viewer if wanted) | Currently written in the same DB transaction; a CloudWatch sink would be best-effort/outbox |
| Receipts | reference string only | `integrations/ReceiptStorage.ts` | S3 (+ presigned URLs) | `Donation.receiptUrl` already stores the future key |
| Scheduled alert scan | `setInterval` (`integrations/alertScheduler.ts`) | `AlertService.runGlobalCheck()` | EventBridge Scheduler → Lambda | Set `ALERT_SCHEDULER_ENABLED=false` on every instance and schedule the same function, so the scan never runs once per instance. `POST /alerts/run-check` stays as manual trigger |
| Transfer workflow | synchronous state machine | `services/transfer.service.ts` | Step Functions (optional) | Each transition is already an idempotent guarded step |
| Offline queue | localStorage in the browser | `frontend/src/offline/` | unchanged (client side) | Server idempotency on `clientRequestId` carries over |
| Secrets/config | `.env` files, validated in `config/env.ts` | `config/env.ts` | SSM Parameter Store / Secrets Manager (injected as env vars) | `DATABASE_URL`, `CORS_ORIGIN`, `TRUST_PROXY`, `ALERT_SCAN_INTERVAL_MS` — see `backend/.env.example` |

## Deployment readiness (cloud-neutral, already in the repo)
No AWS service is used. These pieces exist so a container host (ECS/App Runner/any) can run the app unchanged:
- `backend/Dockerfile` — multi-stage, non-root, `HEALTHCHECK` on `/api/health`, `prisma generate` at build. Run `npx prisma migrate deploy` as a separate release step.
- `frontend/Dockerfile` + `nginx.conf` — static bundle, SPA fallback, immutable asset caching, `/healthz`, optional `/api/` proxy (`VITE_API_URL=/api`). For S3 + CloudFront, upload `dist/` and configure a 403/404 → `/index.html` fallback instead.
- `docker-compose.yml` — local Postgres + API + SPA to verify the containers (`docker compose up --build`).
- `GET /api/health` (liveness) and `GET /api/health/ready` (database reachable, 503 otherwise) for load-balancer checks.
- `CORS_ORIGIN` restricts browser origins (unset = any, dev only); `TRUST_PROXY=1` behind a load balancer.
- Graceful shutdown on `SIGTERM`/`SIGINT` (closes HTTP server, disconnects Prisma).
- Config is read via `config/env.ts` (zod-validated; `DATABASE_URL` is mandatory when `NODE_ENV=production`).
- Structured logs (`utils/logger.ts`): one JSON object per line on stdout/stderr in production, ready for any log collector; readable lines in dev; silent under test. `LOG_LEVEL=debug` adds debug lines.
- Request ids (`middleware/request.middleware.ts`): reuses a valid upstream `x-request-id` or generates one, echoes it on the response, logs one access line per request, and returns it in 5xx bodies so a user-reported error can be matched to its log line.
- Baseline security headers without extra dependencies (`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, HSTS over HTTPS in production); `x-powered-by` off; 1 MB JSON body limit; JSON 404 for unknown `/api` paths.
- Prisma `binaryTargets` include Debian (slim containers) and RHEL (Amazon Linux-based runtimes) engines, so the generated client runs on either.
- `prisma db seed` refuses to run when `NODE_ENV=production` unless `ALLOW_SEED=1` (it truncates every table).
- Frontend pages are lazy-loaded per route (main bundle ~293 kB instead of ~697 kB), and the API client times out after 20 s with a clear message.

## Suggested order
1. RDS + `migrate deploy`, point the API at it.
2. Cognito + JWT middleware (biggest behavioural change; protects everything else).
3. Deploy API, then S3/CloudFront for the SPA.
4. SNS publisher, EventBridge scan, S3 receipts.

## Known gaps to close in AWS
- Demo auth has no passwords; Cognito adds real sign-in and MFA.
- Notifications are console/DB only.
- Receipts are not uploaded.
- Polling instead of push; add WebSocket/AppSync only if real-time becomes a requirement.
- Translations cover shelter information only.
