# SafeHaven — Flood Shelter & Relief Resource Management

A complete **local prototype** of a flood-relief platform: the public finds shelters and registers families, coordinators run their shelter (occupants, stock, transfers, volunteers, donations, medical priorities, reunification), and administrators oversee the whole district. Demo data is set in Chennai (English + Tamil). No AWS services are used yet — see `docs/aws-migration.md`.

## Roles
| Role | Can do |
|---|---|
| Public | find shelters (map, filters, nearest, EN/தமிழ்), register a family and get a reference code, see emergency info, report/search missing persons (privacy-limited) |
| Volunteer | browse and sign up for shifts, cancel, manage profile |
| Coordinator | their own shelter(s): check-in/out, confirm public registrations, offline queue, resources + ledger, transfers, alerts, shifts, donations, medical priorities, reunification, reports, translations |
| Admin | everything: shelters (create/edit/activate), district occupancy and resources, approve/reject transfers, alerts + *Run alert check*, volunteers, medical, donations, reunification, reports, users, audit log, settings |

## Stack
React 19 · Vite · TypeScript · Tailwind 4 · React Router 7 · Leaflet — Node · Express · TypeScript · Prisma · PostgreSQL. Only `zod` (validation) and `vitest` (tests) were added; charts are plain SVG/CSS.

## Setup
Prerequisites: Node 20+, PostgreSQL running locally.

```bash
# 1. databases (psql): CREATE DATABASE safehaven; CREATE DATABASE safehaven_test;
# 2. backend
cd backend
cp .env.example .env          # set DATABASE_URL for "safehaven"
# .env.test must point at "safehaven_test" (tests refuse to run otherwise)
npm install
npx prisma migrate deploy
npx prisma db seed            # WIPES and reseeds the dev database with demo data
npm run dev                   # http://localhost:5000
# 3. frontend
cd ../frontend
npm install
npm run dev                   # http://localhost:5173
```
Open `/login` and pick a demo user (no passwords).

Optional: `ALERT_SCAN_INTERVAL_MS=60000` in `backend/.env` starts the periodic alert scan (never runs under test).

## Commands
| Where | Command | What |
|---|---|---|
| backend | `npx tsc --noEmit` | type check |
| backend | `npm run test` | jest (in band) against `safehaven_test`, which is migrated fresh each run |
| frontend | `npx tsc -b` / `npm run build` | type check / production build |
| frontend | `npm run test` | vitest (offline queue) |

## Demo accounts (after seeding)
Admins: Anitha Rajan, Suresh Babu · Coordinators: Priya Venkatesh (Velachery, Tambaram), Karthik Subramanian (Adyar, Perungudi), Meena Krishnan (Mudichur, T. Nagar) · Volunteers: Divya Lakshmi, Arun Kumar, Fatima Begum. Demo registration codes `SH-DEMO01..03` are pending at Velachery/Tambaram.

## Known limitations (honest list)
- Demo authentication only (no passwords); `x-user-id` header.
- Notifications are console/DB only; receipts are a reference string, not an uploaded file.
- No push: screens show "Current status as of …" with Refresh and optional 30 s polling.
- Offline support covers **check-in only**, and only while the app is already loaded; capacity is verified by the server when the queue syncs.
- Translations cover shelter information (name, description, arrival instructions) and a small label set, not the whole UI.
- `GET /dashboard` (legacy admin payload) is kept for compatibility but unused by the UI.

## Docs
`docs/IMPLEMENTATION_PLAN.md` (plan + progress tracker) · `docs/api.md` · `docs/database.md` · `docs/architecture.md` · `docs/aws-migration.md`
