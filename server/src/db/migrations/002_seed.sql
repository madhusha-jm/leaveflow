-- Demo data. Every user's password is 'password123' (bcrypt, cost 10).
-- A shared password is acceptable ONLY in demo seeds.

INSERT INTO leave_types (name, annual_allocation) VALUES
  ('Annual', 14),
  ('Casual', 7),
  ('Sick',   7);

-- Ishara's manager_id = 1 (Ruwan): the fact "managers approve only their reports" hangs on.
INSERT INTO users (name, email, password_hash, role, manager_id) VALUES
  ('Ruwan Silva',     'ruwan@ceylonroots.lk',  '$2b$10$UAZefNAFgJFzP4atY74EvOUcVMOOsnzUWS8OOYbakxSs1xLzKO0wK', 'MANAGER',  NULL),
  ('Ishara Fernando', 'ishara@ceylonroots.lk', '$2b$10$UAZefNAFgJFzP4atY74EvOUcVMOOsnzUWS8OOYbakxSs1xLzKO0wK', 'EMPLOYEE', 1),
  ('Dilini Perera',   'dilini@ceylonroots.lk', '$2b$10$UAZefNAFgJFzP4atY74EvOUcVMOOsnzUWS8OOYbakxSs1xLzKO0wK', 'HR_ADMIN', NULL);
