# LeaveFlow

Leave requests and approvals for a small team: employees apply, managers approve,
HR sees everything, and balances stay honest (pending requests reserve their days).

- Requirements: [docs/requirements.md](docs/requirements.md)
- API contract: [docs/api.md](docs/api.md)
- Design and decisions: [docs/design.md](docs/design.md)
- Deploying (Render, AWS): [docs/deploy.md](docs/deploy.md)
- Test cases and results: [docs/test-cases.md](docs/test-cases.md)

## Run it with Docker (quickest)

You need only Docker Desktop — no Node, no Postgres install.

```bash
docker compose up --build -d     # first time ~3 min; later starts take seconds
```

- App: http://localhost:8080 (log in with a demo account below)
- Database browser (Adminer): http://localhost:8081 — System *PostgreSQL*, Server `db`,
  user / password / database all `leaveflow`
- Migrations (tables + demo users) run automatically every time the API starts.

| Command | What it does |
|---|---|
| `docker compose up --build -d` | Build (after code changes) and start everything |
| `docker compose ps` | Status — `api` and `db` should say *(healthy)* |
| `docker compose logs -f api` | Follow the API's request log |
| `docker compose down` | Stop. **Data is kept** (the `dbdata` volume) |
| `docker compose down -v` | Stop **and delete all data** — know you mean it |

## Run it locally (for development)

You need Node 20.19+ and Docker Desktop.

```bash
# 1. Database (PostgreSQL 16 on host port 5433)
#    First time only:
docker run -d --name leaveflow-pg -e POSTGRES_PASSWORD=leaveflow_dev -e POSTGRES_DB=leaveflow \
  -p 5433:5432 -v leaveflow-pgdata:/var/lib/postgresql/data postgres:16
#    Every other time:
docker start leaveflow-pg

# 2. API server — http://localhost:4000
cd server
cp .env.example .env             # then fill in DATABASE_URL and JWT_SECRET
npm install
npm run migrate
npm run dev

# 3. React client — http://localhost:5173 (in a second terminal)
cd client
npm install
npm run dev
```

## Run the tests

```bash
cd server
npm test        # 53 tests: unit (leaveDays) + API (Supertest)

cd ../client
npm test        # React component tests (Vitest + Testing Library)

cd ..
npm install
npm run test:e2e   # Playwright: a real Edge browser clicks apply → approve → approved
```

The end-to-end run starts its own API (port 4001, on `leaveflow_test`) and client
(port 5174), so it works whether or not your dev servers are running. It uses the
Microsoft Edge that comes with Windows — no browser download needed.

The API tests use a separate database, `leaveflow_test`, on the same Postgres as your
`.env`. It is created and migrated automatically, and emptied before every test —
your development data is never touched. Docker's `leaveflow-pg` must be running.

## CI/CD

Every pull request runs five checks (`.github/workflows/ci.yml`); `main` only accepts a PR
when all are green:

| Check | What it proves |
|---|---|
| `test-api` | Jest unit + API tests against a throwaway Postgres; coverage report attached to the run |
| `test-client` | Vitest component tests pass and the React app still builds |
| `lint` | ESLint finds nothing in server or client (`npm run lint`) |
| `audit` | No dependency has a known *critical* vulnerability |
| `e2e` | Playwright: apply → approve → approved in a real browser |

Every merge to `main` then publishes both images (`.github/workflows/release.yml`):
`ghcr.io/madhusha-jm/leaveflow-api` and `ghcr.io/madhusha-jm/leaveflow-web`, tagged with the
commit SHA and `main`.

Demo accounts, all with password `password123`:

| Email | Role |
|---|---|
| ishara@ceylonroots.lk | Employee (reports to Ruwan) |
| ruwan@ceylonroots.lk | Manager |
| dilini@ceylonroots.lk | HR admin |
| nimali@ceylonroots.lk | Employee (reports to Kasun) |
| kasun@ceylonroots.lk | Manager |
