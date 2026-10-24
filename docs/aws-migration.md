# AWS migration map

The local prototype has **no AWS code**. Every replaceable concern sits behind a seam so migration swaps an implementation instead of rewriting features.

| Concern | Local today | Seam / file | AWS target | Migration notes |
|---|---|---|---|---|
| Frontend hosting | Vite dev server | — | S3 + CloudFront | `npm run build` output; set `VITE_API_URL`. SPA fallback to `index.html` |
| API | Express on :5000 | `server.ts` | Lambda + API Gateway (or ECS/App Runner) | `app` is exported; wrap with a Lambda adapter. Connection pooling (RDS Proxy) needed for Prisma on Lambda |
| Database | PostgreSQL | `prisma/schema.prisma`, migrations | RDS / Aurora PostgreSQL | `prisma migrate deploy`; no schema change required |
| Authentication | `x-user-id` demo header | `middleware/auth.middleware.ts` | Cognito user pool + JWT | Replace `loadUser`; map `User.cognitoSub` (column already exists); roles → Cognito groups. Routes/services unchanged |
| Notifications | console + `notifiedVia='LOCAL'` | `integrations/NotificationPublisher.ts` | SNS topics (SMS/e-mail/push) or SES | Implement `publish(event)` and return the channel label |
| Audit trail | PostgreSQL `AuditLog` | `integrations/AuditSink.ts` | CloudWatch Logs (keep Postgres for the viewer if wanted) | Currently written in the same DB transaction; a CloudWatch sink would be best-effort/outbox |
| Receipts | reference string only | `integrations/ReceiptStorage.ts` | S3 (+ presigned URLs) | `Donation.receiptUrl` already stores the future key |
| Scheduled alert scan | `setInterval` (`integrations/alertScheduler.ts`) | `AlertService.runGlobalCheck()` | EventBridge Scheduler → Lambda | Remove the interval; schedule the same function. `POST /alerts/run-check` stays as manual trigger |
| Transfer workflow | synchronous state machine | `services/transfer.service.ts` | Step Functions (optional) | Each transition is already an idempotent guarded step |
| Offline queue | localStorage in the browser | `frontend/src/offline/` | unchanged (client side) | Server idempotency on `clientRequestId` carries over |
| Secrets/config | `.env` files | — | SSM Parameter Store / Secrets Manager | `DATABASE_URL`, `ALERT_SCAN_INTERVAL_MS` |

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
