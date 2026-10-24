# SafeHaven API (local prototype)

Base URL: `http://localhost:5000/api`. JSON in, JSON out.

**Auth (demo).** Send `x-user-id: <user id>` to act as a local user. Roles: `ADMIN`, `COORDINATOR`, `VOLUNTEER`; no header means *public*. Unknown or deactivated ids get `401`. `GET /auth/users` lists the demo accounts for the login picker. Coordinators may only act on shelters where `shelter.coordinatorId` is their id (`403` otherwise). Approvers are always the authenticated user, never a body field.

**Errors.** `{ "error": "message", "details"?: [{ "path", "message" }] }`. `400` validation or business rule, `401` not signed in, `403` wrong role/shelter, `404` not found, `409` conflict or already-done action (idempotent replays).

**Privacy.** No public endpoint returns occupant names, contacts or medical data. Public shelter data exposes capacity, status, stock *levels* (HEALTHY / LOW / CRITICAL / EMPTY) and shelter contact details only.

Legend: 🌐 public · 🔑 any signed-in user · 🛡 role(s) listed.

## Auth & users
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/auth/users` | 🌐 | `{id, name, role}` only |
| GET | `/auth/me` | 🔑 | user + `managedShelters` |
| PATCH | `/auth/me` | 🔑 | name, phone, skills, languages |
| GET/POST | `/users` | 🛡 ADMIN | create validates email, duplicates → 409 |
| PATCH | `/users/:id` | 🛡 ADMIN | role / isActive / details. Cannot demote or deactivate yourself or the last admin; a coordinator who still has shelters → 409 |

## Shelters
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/shelters?q&minAvailable&resource&status&includeInactive&lang` | 🌐 | public-safe list; `translation` for `lang` |
| GET | `/shelters/nearest?latitude&longitude&onlyAvailable&limit&lang` | 🌐 | adds `distance` (km) |
| GET | `/shelters/stats/public` | 🌐 | district totals (counts only) |
| GET | `/shelters/:id?lang` | 🌐 | detail + translation (falls back to `en`) |
| GET | `/shelters/managed` | 🛡 ADMIN, COORDINATOR | shelters the caller manages |
| GET | `/shelters/:id/staff` | 🛡 staff of that shelter | editable fields + translations |
| GET | `/shelters/:id/overview` | 🛡 staff of that shelter | occupants, medical counts, resources, alerts, transfers, shifts, donations |
| POST | `/shelters` | 🛡 ADMIN | audited |
| PATCH | `/shelters/:id` | 🛡 ADMIN (all) · COORDINATOR (description, contact, medicalSupport, status ACTIVE↔FULL) | capacity cannot drop below occupancy |
| PATCH | `/shelters/:id/status` | 🛡 ADMIN | soft (de)activation; nothing is hard-deleted |
| PUT | `/shelters/:id/translations/:locale` | 🛡 staff of that shelter | upsert name/description/instructions |

## Check-ins
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/shelters/:id/register` | 🌐 | creates a `PENDING` registration, returns `{referenceCode, …}` only; occupancy untouched |
| POST | `/shelters/:id/checkin` | 🛡 staff | immediate `CONFIRMED`; priority computed; `clientRequestId` makes it idempotent (replay → `200 {duplicate:true}`) |
| GET | `/shelters/:id/checkins?status&priority&q` | 🛡 staff | |
| PATCH | `/shelters/:id/checkin/:checkinId/confirm` | 🛡 staff | pending → confirmed, re-checks capacity |
| PATCH | `/shelters/:id/checkin/:checkinId/reject` | 🛡 staff | pending → cancelled |
| POST | `/shelters/:id/checkout` | 🛡 staff | releases the **stored** family size; double checkout → 409 |

## Resources
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/shelters/:id/resources` | 🌐 / 🛡 staff | public: type + stock status; managing staff: full records |
| POST | `/shelters/:id/resources` | 🛡 staff | reactivates a deactivated resource |
| PATCH | `/shelters/:id/resources/:resourceId` | 🛡 staff | `quantity` (set) **or** `delta` (adjust); negatives rejected; ledger row written |
| GET | `/shelters/:id/resources/movements?resourceId&limit` | 🛡 staff | stock ledger |

## Transfers
`PENDING → APPROVED → IN_TRANSIT → RECEIVED`, plus `REJECTED` / `CANCELLED`. Responses carry `actions` flags (what the caller may do now).
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/transfers` | 🛡 staff | coordinator's own shelter must be source **or** destination. Available = stock − pending outgoing |
| GET | `/transfers?status&shelterId&direction` | 🛡 staff | scoped to involved shelters |
| GET | `/transfers/:id` | 🛡 staff involved | |
| PATCH | `/transfers/:id/approve` | 🛡 ADMIN | cannot approve own request; deducts source (TRANSFER_OUT) |
| PATCH | `/transfers/:id/reject` | 🛡 ADMIN | pending only; optional `reason` |
| PATCH | `/transfers/:id/transit` | 🛡 source shelter staff / ADMIN | |
| PATCH | `/transfers/:id/received` (`/receive` alias) | 🛡 destination staff / ADMIN | adds to destination (TRANSFER_IN) |
| PATCH | `/transfers/:id/cancel` | requester while PENDING; ADMIN until received | restores source if already deducted (TRANSFER_RETURN) |

## Alerts
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/alerts?status&type&shelterId` | 🌐 / 🛡 staff | public: only active FULL / OVERCROWDING notices without detail; coordinator: own shelters; admin: all |
| PATCH | `/alerts/:id/acknowledge` · `/resolve` | 🛡 staff of that shelter | guarded: second call → 409 |
| POST | `/alerts/run-check` | 🛡 ADMIN | `{scanned, created, resolved}`; audited |

## Volunteers
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/volunteers` | 🛡 staff | volunteer users |
| GET | `/volunteers/shifts?shelterId&upcoming` | 🔑 | volunteers see counts; managing staff see names |
| POST | `/volunteers/shifts` | 🛡 staff of the shelter | |
| PATCH | `/volunteers/shifts/:shiftId` | 🛡 staff of the shelter | edit or `status: CANCELLED` |
| POST / DELETE | `/volunteers/shifts/:shiftId/signup` | 🛡 VOLUNTEER | full / overlap / started / duplicate checks, row-locked |
| DELETE | `/volunteers/shifts/:shiftId/volunteers/:volunteerId` | 🛡 staff of the shelter | |
| GET | `/volunteers/me/shifts` | 🛡 VOLUNTEER | |

## Donations
| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/donations?shelterId&resourceType&status&from&to` | 🛡 staff | scoped |
| POST | `/donations` | 🛡 staff of the shelter | `applyToInventory` accepts and adds stock in the same transaction |
| PATCH | `/donations/:id` | 🛡 staff of the shelter | notes / receipt reference; `status: ACCEPTED` applies stock **once**, `REJECTED` never |

## Reunification
| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/reunification` | 🌐 | returns `{id, status:"MISSING", message}` only |
| GET | `/reunification/public-search?q=` | 🌐 | ≥ 2 chars; name, age, status, shelter name. No contacts, no occupant data |
| GET | `/reunification?q&status` | 🛡 staff | full case + candidate occupants from the caller's shelters |
| PATCH | `/reunification/:id` (`/:id/status` alias) | 🛡 staff | status, staffNotes, matchedCheckinId |

## Dashboard & reports (🛡 ADMIN, COORDINATOR — coordinators auto-scoped; all accept `?shelterId`)
`GET /dashboard` (ADMIN, legacy overview) · `/dashboard/district` · `/dashboard/resources` · `/dashboard/medical` · `/dashboard/volunteers` · `/dashboard/donations` · `/dashboard/reports` (one aggregate payload).

## Admin
`GET /audit?entity&userId&action&page&pageSize` · `GET /audit/facets` · `GET/PATCH /settings` (validated ranges; audited). All 🛡 ADMIN.

## Health
`GET /health` → `{status:"ok"}`.
