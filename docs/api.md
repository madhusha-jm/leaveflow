# LeaveFlow API contract (v1)

Base URL: `http://localhost:4000/api`
All request and response bodies are JSON (`Content-Type: application/json`).
Auth: `Authorization: Bearer <JWT>` on every endpoint except `POST /auth/login`.
Dates are `YYYY-MM-DD` strings; timestamps are ISO-8601 UTC.

## Error shape

Every error, from every endpoint, uses one envelope:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "end_date must be on or after start_date" } }
```

| Status | Meaning | Example `code` |
|--------|---------|----------------|
| 400 | Request is malformed or breaks a rule | `VALIDATION_ERROR`, `INVALID_JSON` |
| 401 | Not logged in / bad or expired token | `NO_TOKEN`, `BAD_TOKEN`, `BAD_CREDENTIALS` |
| 403 | Logged in, but not allowed | `FORBIDDEN` |
| 404 | No such resource | `NOT_FOUND` |
| 409 | Clashes with the resource's current state | `INVALID_STATE`, `INSUFFICIENT_BALANCE`, `OVERLAPPING_REQUEST`, `HOLIDAYS_NOT_LOADED` |
| 413 | Body larger than 10 kB | `PAYLOAD_TOO_LARGE` |
| 429 | More than 10 *failed* login attempts in 15 minutes from one IP | `TOO_MANY_ATTEMPTS` |

Limits: `reason` is optional text, at most 500 characters (trimmed). `GET /health` (no auth)
returns 200 when the API and database answer, 503 `{"status":"degraded"}` when the database doesn't.

## Endpoints

| Method | Path                  | Who            | Success | Errors                  |
|--------|-----------------------|----------------|---------|-------------------------|
| POST   | /auth/login           | anyone         | 200     | 400, 401, 429           |
| GET    | /me                   | any user       | 200     | 401                     |
| GET    | /leave-requests       | see below      | 200     | 400, 401                |
| POST   | /leave-requests       | any user (own) | 201     | 400, 401, 409           |
| PATCH  | /leave-requests/:id   | see below      | 200     | 400, 401, 403, 404, 409 |
| GET    | /balances             | see below      | 200     | 400, 401, 403, 404      |
| GET    | /team/requests        | MANAGER, HR_ADMIN | 200  | 401, 403                |

### Visibility rules

- `GET /leave-requests` — EMPLOYEE and MANAGER see only their own requests; HR_ADMIN sees all (US-9).
  Optional filter `?status=PENDING|APPROVED|REJECTED|CANCELLED`; any other value → 400.
- `GET /balances` — your own by default. `?user_id=N` shows a direct report's balance (their manager) or anyone's (HR_ADMIN), so an approver sees what a decision leaves; otherwise 403. Optional `?year=` (default: current year).
- `GET /team/requests` — PENDING requests of the caller's direct reports (`users.manager_id = me`); HR_ADMIN sees every PENDING request.

### PATCH actions — the state machine as access rules

Body: `{ "action": "approve" | "reject" | "cancel" }`

| Action  | Transition            | Who may do it                                   |
|---------|-----------------------|-------------------------------------------------|
| approve | PENDING → APPROVED    | requester's manager, or HR_ADMIN                |
| reject  | PENDING → REJECTED    | requester's manager, or HR_ADMIN                |
| cancel  | PENDING → CANCELLED   | the requester (owner) only                      |

- Nobody may approve or reject their **own** request → 403.
- Any action on a request that is not PENDING → `409 INVALID_STATE` (decisions are final).
- approve/reject record `decided_by` (from the token) and `decided_at` (NFR-3).

### Create rules (`POST /leave-requests`)

Checked in this order — cheap checks before any database read, the write last (the overlap check, balance check and insert run in one transaction that locks the user, so
two requests from the same person are handled one after the other — issues #23, #24):

1. `leave_type_id`, `start_date`, `end_date` present and well-formed → else 400.
2. `end_date >= start_date` → else 400.
3. Span at most 30 calendar days → else 400.
   Start and end in the same calendar year → else 400 ("make one ending 31 Dec and one starting 1 Jan";
   each year has its own balance — issue #25).
4. No overlap with the caller's own PENDING or APPROVED requests
   (`existing.start_date <= new.end_date AND existing.end_date >= new.start_date`) → else `409 OVERLAPPING_REQUEST`.
5. Requested days ≤ available balance, where
   **available = allocation − approved days − pending days** for that type and year → else `409 INSUFFICIENT_BALANCE`.
6. Insert with status `PENDING`. The pending days are reserved immediately (they reduce "available").

`user_id` is always taken from the token, never from the body.

### `GET /team/requests` — the approval inbox

Each PENDING request also carries `also_off` (US-14): the requester's teammates (same manager)
whose APPROVED or PENDING requests overlap its dates, e.g.
`[{"name":"Sahan Wickramasinghe","start_date":"2026-11-04","end_date":"2026-11-05","status":"APPROVED"}]`
— `[]` when nobody else is off.

## Examples

### Login

```http
POST /api/auth/login HTTP/1.1
Content-Type: application/json

{ "email": "ishara@ceylonroots.lk", "password": "password123" }

HTTP/1.1 200 OK

{ "token": "eyJhbGciOiJIUzI1NiIs...", "user": { "id": 2, "name": "Ishara Fernando", "role": "EMPLOYEE" } }
```

### Create a leave request

```http
POST /api/leave-requests HTTP/1.1
Host: localhost:4000
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "leave_type_id": 1,
  "start_date": "2026-05-01",
  "end_date": "2026-05-03",
  "reason": "Vesak trip to Kandy with family"
}

HTTP/1.1 201 Created
Content-Type: application/json

{
  "id": 42,
  "user_id": 2,
  "leave_type_id": 1,
  "start_date": "2026-05-01",
  "end_date": "2026-05-03",
  "reason": "Vesak trip to Kandy with family",
  "status": "PENDING",
  "decided_by": null,
  "decided_at": null,
  "created_at": "2026-04-20T09:14:00Z"
}
```

### Validation error

```http
HTTP/1.1 400 Bad Request

{ "error": { "code": "VALIDATION_ERROR", "message": "end_date must be on or after start_date" } }
```

### Overlapping request

```http
HTTP/1.1 409 Conflict

{
  "error": {
    "code": "OVERLAPPING_REQUEST",
    "message": "overlaps your PENDING request #42 (2026-05-01 to 2026-05-03)"
  }
}
```

### Insufficient balance

```http
HTTP/1.1 409 Conflict

{ "error": { "code": "INSUFFICIENT_BALANCE", "message": "only 2 Annual day(s) available (3 pending)" } }
```

### Approve

```http
PATCH /api/leave-requests/42 HTTP/1.1
Authorization: Bearer <ruwan's jwt>
Content-Type: application/json

{ "action": "approve" }

HTTP/1.1 200 OK

{ "id": 42, "status": "APPROVED", "decided_by": 1, "decided_at": "2026-04-21T03:02:11Z", ... }
```

### Balances

```http
GET /api/balances HTTP/1.1
Authorization: Bearer <jwt>

HTTP/1.1 200 OK

[
  { "leave_type_id": 1, "name": "Annual", "allocation": 14, "approved_days": 4, "pending_days": 2, "available": 8 },
  { "leave_type_id": 2, "name": "Casual", "allocation": 7,  "approved_days": 0, "pending_days": 0, "available": 7 },
  { "leave_type_id": 3, "name": "Sick",   "allocation": 7,  "approved_days": 0, "pending_days": 0, "available": 7 }
]
```

The UI renders this as "Annual: 8 available (2 pending)" (US-3).

---

## What is actually running today (Phase 5, Part E)

The whole contract above is implemented, on PostgreSQL, with JWT auth (HS256, 8-hour tokens),
and a React client (`client/`, Vite on port 5173) uses it: login, balances, apply, my requests
with cancel, and an approvals inbox for managers and HR. Vite proxies `/api` to port 4000.
Known gaps:

- `days` excludes weekends and the public holidays in `server/src/lib/holidays.js`. That 2026
  list is **provisional** (Q3): poya dates must be confirmed with HR, and moon-sighted holidays
  (Ramazan, Hajj, Milad-un-Nabi, Deepavali) are not in it yet. The React form's day preview
  counts Mon–Fri only; the server's number is the one stored.
- A year with **no holiday list** can't be booked: `409 HOLIDAYS_NOT_LOADED`, and the server
  prints a warning at startup if this year or next is missing (issue #26). **2027 is missing** —
  HR must supply it before anyone can book 2027 leave.
- The role inside a token is fixed for its 8-hour life; a role change takes effect at next login.
- The client keeps the token in `localStorage` — simple, but readable by any script on the page.
  Acceptable for an internal MVP with no third-party scripts; revisit (httpOnly cookie) before launch.

Demo accounts (password `password123`): ruwan (MANAGER of ishara), ishara (EMPLOYEE),
dilini (HR_ADMIN), kasun (MANAGER of nimali), nimali (EMPLOYEE) — all `@ceylonroots.lk`.
