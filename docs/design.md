# DESIGN DOC — LeaveFlow v1

**Status:** draft, pending Nadeesha's answers to Q1–Q5 (see `requirements.md` §6)
**Date:** 2026-09 · **Related:** `docs/requirements.md` (SRS v0.1), `docs/api.md` (contract)

## Context

Ceylon Roots (~60 staff) tracks leave through email, WhatsApp and a spreadsheet. Requests get lost,
nobody knows their balance, and two of three QC officers were once off in the same week.
Must-haves for v1: login, apply, balances, approve/reject, cancel pending, request status
(US-1, 2, 3, 4, 5, 10). Employees use phones on the factory floor (NFR-4).

## Architecture

```mermaid
flowchart LR
  B["React SPA<br/>(browser, phones)"] -- "HTTP + JSON<br/>Bearer JWT" --> A["Express API<br/>rules + auth"]
  A -- "SQL ($1 params)" --> D[("PostgreSQL<br/>the only copy of truth")]
```

The browser never talks to the database. Every rule that matters — who may approve, balance limits,
state transitions — lives in the API, because anything in the browser can be bypassed with DevTools.

Build order: **v0** (Phase 3) is a single Express server with SQLite and no auth, to prove the path
end to end. **v1** (Phase 5) splits into the three tiers above.

## Data model

```mermaid
erDiagram
  users ||--o{ users : "manages (manager_id)"
  users ||--o{ leave_requests : "requests (user_id)"
  users ||--o{ leave_requests : "decides (decided_by)"
  leave_types ||--o{ leave_requests : "leave_type_id"
  users ||--o{ leave_balances : "user_id"
  leave_types ||--o{ leave_balances : "leave_type_id"

  users {
    int id PK
    text name
    text email UK
    text password_hash
    text role "EMPLOYEE | MANAGER | HR_ADMIN"
    int manager_id FK
    timestamptz created_at
  }
  leave_types {
    int id PK
    text name UK "Annual, Casual, Sick"
    int annual_allocation "14, 7, 7"
  }
  leave_requests {
    int id PK
    int user_id FK
    int leave_type_id FK
    date start_date
    date end_date
    numeric days "working days, fixed at submit"
    text reason
    text status "PENDING | APPROVED | REJECTED | CANCELLED"
    int decided_by FK
    timestamptz decided_at
    timestamptz created_at
  }
  leave_balances {
    int user_id PK,FK
    int leave_type_id PK,FK
    int year PK
    numeric used_days "approved days only"
  }
```

## Request state machine

```mermaid
stateDiagram-v2
  [*] --> PENDING : employee applies
  PENDING --> APPROVED : approve (manager / HR)
  PENDING --> REJECTED : reject (manager / HR)
  PENDING --> CANCELLED : cancel (owner)
  APPROVED --> [*]
  REJECTED --> [*]
  CANCELLED --> [*]
```

No arrow leaves a final state, so "can I cancel an approved request?" has a definite answer: no → 409.

## Sequence — Ishara applies for leave

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as API (Express)
  participant D as DB (Postgres)
  B->>A: POST /api/leave-requests
  A->>A: validate fields, dates, 30-day span
  A->>D: SELECT overlapping PENDING/APPROVED requests
  D-->>A: none
  A->>D: SELECT allocation, used_days, SUM(pending days)
  D-->>A: 14, 4, 2
  A->>A: 3 requested ≤ 8 available?
  A->>D: INSERT request (PENDING)
  D-->>A: row id 42
  A-->>B: 201 Created + JSON
```

## Decisions

- **D1 — 3-tier: React SPA / Express API / PostgreSQL.** v0 is one Express server + SQLite so we can
  demo end to end in week 3; v1 splits the tiers.
- **D2 — Four tables:** `users`, `leave_types`, `leave_requests`, `leave_balances(user, type, year)`.
  Balances are per year because allocations reset annually and HR needs past years for audit.
- **D3 — Pending reserves days (from SRS).** `available = allocation − used_days − pending_days`.
  - `used_days` (approved) is stored in `leave_balances` and changes **only** inside the approve transaction.
  - `pending_days` is **computed** at read time: `SUM(days)` of the user's PENDING requests for that type/year.
  - `available` is never stored.
  Cancel and reject therefore need no balance update — the PENDING row simply stops counting.
- **D4 — Store `days` on each request**, computed once at submit. The day count depends on the
  weekend/holiday rules (Q3); fixing it at submit means a later holiday-calendar change can't silently
  rewrite the history of old requests. `NUMERIC(4,1)` leaves room for half days.
- **D5 — Status is an enum** checked by a `CHECK` constraint, driven by the state machine above.
- **D6 — Approve is one transaction:** `UPDATE leave_requests … WHERE id = $1 AND status = 'PENDING'`
  then upsert `leave_balances.used_days`. Both land or neither does.
- **D7 — JSON REST API under `/api`**, nouns in URLs, one error envelope `{ error: { code, message } }`.
- **D8 — Identity comes from the JWT**, never from the request body. Roles: EMPLOYEE, MANAGER, HR_ADMIN.
- **D9 — Approval flow assumption (pending Q1):** a request needs **one** decision, by the requester's
  manager *or* HR_ADMIN. HR can see and decide everything, which covers "it must come to me" in practice.
  If Nadeesha answers "manager then HR", we add a `MANAGER_APPROVED` state between PENDING and APPROVED —
  a state-machine change, cheap now, expensive after launch.

## Alternatives considered

- **A1 — Keep the spreadsheet plus scripts.** Rejected: no access control, no audit trail (NFR-2, NFR-3).
- **A2 — Store `remaining_days`.** Rejected: it is derived data and drifts after any bug or manual fix.
- **A3 — Store a `pending_days` counter too.** Rejected: every create/cancel/reject/approve would have to
  keep it in sync. Summing PENDING rows is exact and cheap at 60 users.
- **A4 — Compute `used_days` from APPROVED rows as well, drop `leave_balances`.** Viable and the
  "purest" option. Kept the table because it gives a home for future per-user allocations
  (rollover, Q2; pro-rata for new joiners), and a single writer (D6) keeps it honest.
- **A5 — `is_approved BOOLEAN`.** Rejected: can't tell REJECTED from CANCELLED from PENDING.
- **A6 — Half days as `day_part` enum (FULL/AM/PM) vs. only allowing `days = 0.5`.** Decided in the
  capstone: the enum (D10) — `days = 0.5` alone can't tell a manager *which* half is off.
- **A7 — Microservices / queues / cache.** Rejected for 60 users (NFR-5); see R1.

## Deferred requirements — designed for, not built in v1

| Requirement | Design sketch |
|---|---|
| Rule-1/2: sick > 3 consecutive days needs a medical certificate before approval | `certificate_url` column on `leave_requests`; approve returns `409 CERTIFICATE_REQUIRED` when `leave_type = Sick AND days > 3 AND certificate_url IS NULL` |
| Rule-3: no annual leave over New Year shutdown | `public_holidays(date PK, name, is_shutdown)` table; create returns `409 COMPANY_HOLIDAY` when an Annual request overlaps a shutdown date |
| US-11–13: finance year-end report | `GET /api/reports/leave-summary?year=&department=` (HR/finance role), CSV output; needs a `department` column on `users` |
| US-8: email on decision | sent after the approve/reject transaction commits, never inside it |

## Capstone — half-day leave and holiday calendar (US-15 – US-18)

### Data model changes — migration `005_half_days_and_holidays.sql`

```sql
ALTER TABLE leave_requests
  ADD COLUMN day_part TEXT NOT NULL DEFAULT 'FULL'
    CHECK (day_part IN ('FULL', 'MORNING', 'AFTERNOON')),
  -- a half day is always a single date
  ADD CONSTRAINT half_day_single_date
    CHECK (day_part = 'FULL' OR start_date = end_date);

CREATE TABLE holidays (
  date       DATE PRIMARY KEY,             -- one holiday per date (duplicate → 409)
  name       TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id), -- NULL for the seeded 2026 list
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- + INSERT the 16 dates now in server/src/lib/holidays.js, so nothing changes for 2026.
```

Existing requests become `FULL` through the default — no data migration needed.

### Decisions

- **D10 — Half day = `day_part` MORNING | AFTERNOON on a single date, `days = 0.5`.**
  The enum (not just `days = 0.5`) tells the manager which half is off (US-15). Single date only
  until Nadeesha answers capstone question 1; the `CHECK` enforces it even if the API has a bug.
- **D11 — Balance maths does not change (US-16).** `days`, `used_days` are already `NUMERIC(4,1)` and
  the pg driver returns them as JS numbers, so 14 − 0.5 = 13.5 flows through D3 untouched. The only
  new rule is in create: a half day on a weekend or holiday is 400 (0 working days, as today).
- **D12 — Overlap with half days.** MORNING and AFTERNOON on the same date do **not** overlap; any
  other pair on the same date does (FULL + anything, or the same half twice). Added to the existing
  overlap query as `AND NOT (existing.day_part <> 'FULL' AND new.day_part <> 'FULL' AND existing.day_part <> new.day_part)`.
- **D13 — Holidays move from code to the `holidays` table (US-17, fixes the root cause of #26).**
  `holidaysBetween()` becomes an async DB query; a year with **no rows** is still
  `409 HOLIDAYS_NOT_LOADED`. HR adds 2027 in the app — no developer, no redeploy. The startup
  warning reads the table instead of the constant.
- **D14 — Holiday changes never rewrite existing requests (D4).** Adding Duruthu Poya does not
  refund days on an already-approved request; HR handles that case by hand until Nadeesha answers
  capstone question 3. Deleting a holiday likewise leaves old requests alone.
- **D15 — Who edits holidays:** HR_ADMIN only (403 for others, as US-17). Everyone logged in may
  *read* them, so the apply form can show "1 May is Vesak" before submitting.

### Sequence — Ishara books a morning off

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as API
  participant D as Postgres
  B->>A: POST /api/leave-requests {type 1, 2026-03-09, 2026-03-09, day_part MORNING}
  A->>A: validate: half day ⇒ start = end
  A->>D: SELECT date FROM holidays WHERE date = 2026-03-09
  D-->>A: none → working day → days = 0.5
  A->>D: BEGIN; lock user; overlap check (D12); balance check
  A->>D: INSERT (PENDING, day_part MORNING, days 0.5); COMMIT
  A-->>B: 201 Created
```

### Alternatives considered

- **A8 — Hours instead of half days.** Rejected: needs working-hours rules HR hasn't given (question 2)
  and changes every balance from days to hours.
- **A9 — Keep holidays in code, add 2027 by hand.** Rejected: that is exactly issue #26; it happens every year.
- **A10 — A yearly JSON file HR uploads.** Rejected: still needs a deploy or file storage; a table
  with three endpoints is less work and gives an audit column (`created_by`).

### Risks

- **R6** — Questions 1, 3, 4 are unanswered; D10/D14 are assumptions. D10 is the cheapest to relax
  later (drop the `CHECK`, extend the day count).
- **R7** — If HR deletes all holidays of a year by mistake, booking for that year stops with 409 —
  safe (no miscount), and HR can re-add them.

## Risks

- **R1** — 60 users is small; resist imaginary scale. Revisit only if Ceylon Roots' group companies join.
- **R2** — Q1 (approval flow) is unanswered; D9 is an assumption. **Blocking** for the approve endpoint's final shape.
- **R3** — Q3 (weekends/poya days) is unanswered. Since Phase 6, `days` excludes weekends and a
  provisional 2026 holiday list in code (`server/src/lib/holidays.js`); a wrong date there silently
  miscounts leave, so HR must confirm it. The capstone (D13) moves it to a table HR edits.
- **R4** — Q2 (rollover) is unanswered; v1 resets allocations every 1 January.
- **R5** — Race: two requests submitted at the same moment could both pass the balance check.
  Acceptable at this scale; if it matters, lock the user's balance row (`SELECT … FOR UPDATE`) during create.
