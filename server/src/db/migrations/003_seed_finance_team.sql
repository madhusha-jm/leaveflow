-- A second team, so "managers decide only for their own reports" can be demoed and tested:
-- Ruwan must NOT be able to decide Nimali's leave; Kasun must not decide Ishara's.
-- Password 'password123' for both, same demo hash as 002_seed.sql.

INSERT INTO users (name, email, password_hash, role, manager_id) VALUES
  ('Kasun Bandara', 'kasun@ceylonroots.lk',
   '$2b$10$UAZefNAFgJFzP4atY74EvOUcVMOOsnzUWS8OOYbakxSs1xLzKO0wK', 'MANAGER', NULL);

INSERT INTO users (name, email, password_hash, role, manager_id)
SELECT 'Nimali Jayawardena', 'nimali@ceylonroots.lk',
       '$2b$10$UAZefNAFgJFzP4atY74EvOUcVMOOsnzUWS8OOYbakxSs1xLzKO0wK', 'EMPLOYEE', id
  FROM users WHERE email = 'kasun@ceylonroots.lk';
