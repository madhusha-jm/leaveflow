# Running LeaveFlow in production

What to do when something breaks, and the checks that keep it from breaking. Written for the
Render deployment ([deploy.md](deploy.md)); the AWS equivalents are in brackets.

## Severity

| SEV | Meaning | Response |
|-----|---------|----------|
| SEV1 | Down, or leave data wrong/lost | Drop everything; update Nadeesha every 30 min |
| SEV2 | A feature broken, workaround exists | Fix today |
| SEV3 | Annoying | Fix this week |

## Runbook — follow it top to bottom, out loud

1. **Symptom.** Write down what was reported, by whom, and when it started.
2. **Health.** `curl https://<api URL>/api/health`
   - `200 "db":"ok"` → app and database up; the problem is narrower.
   - `503 "db":"unreachable"` → database: go to step 4.
   - no answer / 502 → the API is down or (free tier) waking up — wait 60 s, retry once.
3. **Logs.** Render → `leaveflow-api` → **Logs** (search box filters) [AWS: `aws logs tail … --filter-pattern '{ $.res.statusCode = 401 }'`].
   Logs are JSON: search `"statusCode":500`, `"level":50` (error) or a user's `X-Request-Id`.
   Ask: which route? since exactly when? what changed at that minute (**Events** tab: deploys, env changes)?
4. **Database.** Render → `leaveflow-db` → status, connections, storage [AWS: RDS console].
5. **Mitigate first, diagnose second.** Render → `leaveflow-api` → **Events** → a previous
   successful deploy → **Rollback**. Or undo the config change you found in step 3. Fix forward
   only if the fix is one obvious line.
6. **Communicate.** Tell Nadeesha: what is broken, what you are doing, when the next update is.
7. **Afterwards.** Blameless post-mortem within 48 h (template below).

## Post-mortem template (blameless: name causes, never culprits)

```
INCIDENT <date>: <one line> (SEV<n>, <prod/staging>)
Timeline      <hh:mm> first signal · <hh:mm> diagnosed · <hh:mm> mitigated · <hh:mm> resolved
Impact        who could not do what, for how long
Root cause    what in the system allowed it
Went well     …
Went badly    …
Action items  <owner> <what> <by when>   (each one makes the system safer, not a person more careful)
```

## Incident drill (mentor runs it)

Mentor: in Render → `leaveflow-api` → **Environment**, change `JWT_SECRET` to a new random value
and save (it redeploys). Tell the intern only: *"Users can't stay logged in. You're on point."*
Intern: run the runbook. Expected trail: health is green → logs show a wall of 401 `BAD_TOKEN`
from one exact minute → **Events** shows an environment change at that minute. Fix: either
restore the old secret, or accept the rotation and announce "everyone must log in again" —
say which and why. Then write the post-mortem; the write-up is the deliverable.

## Backups and the restore drill

- **Render free Postgres has no backups** and expires after 30 days — acceptable for the demo
  only. A paid Render database (or AWS RDS) takes daily snapshots.
- Until then, take a manual backup (Render → `leaveflow-db` → **Connect** → *External URL*):
  ```
  docker run --rm postgres:16 pg_dump "<external URL>" > leaveflow-backup.sql
  ```
- **Restore drill** — a backup you've never restored doesn't exist:
  1. Restore into a *new* throwaway database (never over the original), e.g. the local one:
     `docker exec -i leaveflow-pg psql -U postgres -c "CREATE DATABASE restore_test"` then
     `docker exec -i leaveflow-pg psql -U postgres -d restore_test < leaveflow-backup.sql`
  2. Point a local API at it (`DATABASE_URL=…/restore_test npm run dev`), log in, and check
     real requests are there.
  3. Drop `restore_test`. Log: date, backup used, **minutes from start to verified** — that is
     your measured **RTO**. The time since the backup was taken is your **RPO** exposure.

## Security self-audit (OWASP Top 10, the parts that apply)

| Threat | Defence | How it was verified |
|---|---|---|
| SQL injection | Every query uses `$1` parameters | `grep` of all `query(` calls: no user input spliced into SQL text (29 Sep 2026) |
| Broken access control | Role + ownership checks → 403 | API tests: cancel someone else's request → 403; another team's manager approves → 403; employee reads a colleague's balance → 403 |
| Secrets exposure | Secrets only in env vars; `.env` git-ignored and docker-ignored; logs redact `Authorization` | Log check: a request with a bearer token logs `"authorization":"[Redacted]"`; token string appears 0 times |
| Vulnerable dependencies | `audit` CI check (critical) + Dependabot PRs | CI `audit` job green on every PR |
| Login brute force | 10 failed logins / 15 min per client IP → 429; real client IP behind proxies (`TRUST_PROXY`) | API test `rateLimit.test.js`; docker compose check: second client unaffected, spoofed `X-Forwarded-For` ignored |
| Race conditions on balances | Per-user lock around check + insert | API tests for concurrent requests (issues #23, #24) |
| XSS | React escapes all text | Exploratory E5: `<script>` reason shown as text, no script ran |

**Known gaps:** demo accounts share `password123` (change before real use); the JWT lives in
`localStorage` (fine without third-party scripts; move to an httpOnly cookie before wider use);
a role change takes effect only at next login (8 h token).
