-- A second person on Ruwan's team, so "who else is off that week" (US-14) has
-- someone to show. Password 'password123', same demo hash as 002_seed.sql.
INSERT INTO users (name, email, password_hash, role, manager_id)
SELECT 'Sahan Wickramasinghe', 'sahan@ceylonroots.lk',
       '$2b$10$UAZefNAFgJFzP4atY74EvOUcVMOOsnzUWS8OOYbakxSs1xLzKO0wK', 'EMPLOYEE', id
  FROM users WHERE email = 'ruwan@ceylonroots.lk';
