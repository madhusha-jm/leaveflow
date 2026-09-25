const Database = require('better-sqlite3');
const db = new Database('leaveflow.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'EMPLOYEE',
    manager_id INTEGER REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS leave_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    decided_by INTEGER REFERENCES users(id),
    decided_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Seed the three demo users once, on first boot.
const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
if (userCount === 0) {
  const ins = db.prepare(
    'INSERT INTO users (name, email, role, manager_id) VALUES (?, ?, ?, ?)'
  );
  ins.run('Ruwan Silva', 'ruwan@ceylonroots.lk', 'MANAGER', null);      // id 1
  ins.run('Ishara Fernando', 'ishara@ceylonroots.lk', 'EMPLOYEE', 1);   // id 2
  ins.run('Dilini Perera', 'dilini@ceylonroots.lk', 'HR_ADMIN', null);  // id 3
}

module.exports = db;
