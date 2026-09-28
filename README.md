# LeaveFlow

Leave requests and approvals for a small team: employees apply, managers approve,
HR sees everything, and balances stay honest (pending requests reserve their days).

- Requirements: [docs/requirements.md](docs/requirements.md)
- API contract: [docs/api.md](docs/api.md)
- Design and decisions: [docs/design.md](docs/design.md)

## Run it locally

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
```

The API tests use a separate database, `leaveflow_test`, on the same Postgres as your
`.env`. It is created and migrated automatically, and emptied before every test —
your development data is never touched. Docker's `leaveflow-pg` must be running.

Demo accounts, all with password `password123`:

| Email | Role |
|---|---|
| ishara@ceylonroots.lk | Employee (reports to Ruwan) |
| ruwan@ceylonroots.lk | Manager |
| dilini@ceylonroots.lk | HR admin |
| nimali@ceylonroots.lk | Employee (reports to Kasun) |
| kasun@ceylonroots.lk | Manager |
