# Deploying LeaveFlow

Two targets, as in the Field Guide's Phase 9:

| | Render (done here) | AWS (optional, costs money) |
|---|---|---|
| Effort | one Blueprint, ~10 minutes | a day of console work |
| Cost | free | ~US$20–25/month after free tier |
| Good for | the demo Nadeesha asked for | a production-shaped setup on `leave.ceylonroots.lk` |
| Catch | free API sleeps after ~15 idle min (first request then takes 30–60 s); free DB **expires after 30 days** | you must tear it down when done |

## Render — step by step

`render.yaml` in the repo root describes everything, so Render builds the whole stack at once.

1. Go to **https://render.com** → **Get Started** → **Sign in with GitHub** as `madhusha-jm`.
2. Dashboard → **New** (top right) → **Blueprint**.
3. **Connect** the `leaveflow` repository (if it isn't listed: *Configure account* → give Render access to it).
4. Blueprint name: `leaveflow`. Render reads `render.yaml` and lists three resources:
   `leaveflow-db` (PostgreSQL), `leaveflow-api` (Web Service, Docker), `leaveflow-web` (Static Site).
5. Click **Deploy Blueprint** / **Apply**. First build: ~5–8 minutes.
6. Open **leaveflow-api** → wait for **Live**. Its URL is at the top, normally
   `https://leaveflow-api-<letters>.onrender.com`.
   - Ours is `https://leaveflow-api-zxnk.onrender.com` (the plain name belongs to another
     account). **Never leave `/api/*` pointing at a URL you don't own** — it would receive logins.
   - If the URL is **different** (e.g. the API was recreated):
     open **leaveflow-web** → **Redirects/Rewrites** → edit the `/api/*` rule's destination to
     `https://<the real api URL>/api/*` → **Save**.
7. Check the API: open `https://<api URL>/api/health` →
   `{"status":"ok", … "db":"ok"}`. (Migrations ran automatically on start — the logs show
   `applied 001_init.sql` …)
8. Open **leaveflow-web**'s URL (`https://leaveflow-web.onrender.com` or similar) → log in as
   `ishara@ceylonroots.lk` / `password123` → apply → log in as Ruwan → approve.
9. Send Nadeesha the leaveflow-web URL. It works from home and on mobile data, over HTTPS.

**Every merge to `main` redeploys automatically** (Render watches the repo). Because `main` is
protected by the five CI checks, only code that passed CI can reach Render.

### Before real use — change the demo passwords
The seed users all have `password123` and the repo is public. Fine for a demo; before anyone
real uses it, change them (or add a password-change feature).

### Teardown (do it when the demo is over)
Dashboard → each of `leaveflow-web`, `leaveflow-api`, `leaveflow-db` → **Settings** → **Delete**.
Or delete the Blueprint, which offers to delete its resources.

## AWS (Phase 9 part 2) — only with your mentor's go-ahead

Needs an AWS account with billing, and a real domain (`leave.ceylonroots.lk` is the guide's
example). If your mentor wants it, follow the guide's part 2 in this order — **budget alarm
before any resource**:

1. Root account: enable MFA; create an IAM user; stop using root.
2. Billing → Budgets → monthly **$10** budget, alert at 80%.
3. ECR repo `leaveflow-api`; pull `ghcr.io/madhusha-jm/leaveflow-api:main` (published by
   `release.yml`), retag, push.
4. RDS PostgreSQL 16, `db.t4g.micro`, **public access: No**, security group `leaveflow-db-sg`.
5. App Runner from the ECR image, port 4000, health check `/api/health`, env `DATABASE_URL`,
   `JWT_SECRET` (new random), `TRUST_PROXY=1`; VPC connector; allow 5432 into `leaveflow-db-sg`
   **only** from the connector's security group. Migrations already run on start (the image's
   CMD), so no extra start command is needed.
6. S3 bucket (private) + CloudFront (OAC); second origin = App Runner, behavior `/api/*`
   with CachingDisabled + AllViewer.
7. ACM certificate in **us-east-1**, DNS validation, CNAME `leave` → the CloudFront domain.

**Teardown checklist:** CloudFront distribution (disable, then delete) → S3 bucket → App Runner
service → VPC connector → RDS instance (and its snapshots) → ECR repo → ACM certificate →
budget stays.
