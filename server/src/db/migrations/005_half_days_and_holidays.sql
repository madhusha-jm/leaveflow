-- Capstone (US-15 – US-18) — see docs/design.md, D10–D15.

-- D10: a half day is MORNING or AFTERNOON on a single date; existing requests become FULL.
ALTER TABLE leave_requests
  ADD COLUMN day_part TEXT NOT NULL DEFAULT 'FULL'
    CHECK (day_part IN ('FULL', 'MORNING', 'AFTERNOON')),
  ADD CONSTRAINT half_day_single_date
    CHECK (day_part = 'FULL' OR start_date = end_date);

-- D13: public holidays move out of src/lib/holidays.js into a table HR edits in the app.
CREATE TABLE holidays (
  date       DATE PRIMARY KEY,             -- one holiday per date (a duplicate is a 409)
  name       TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  created_by INTEGER REFERENCES users(id), -- NULL for the seeded list below
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The provisional 2026 list that used to live in code (poya dates still to be confirmed by HR).
INSERT INTO holidays (date, name) VALUES
  ('2026-01-15', 'Tamil Thai Pongal'),
  ('2026-02-02', 'Navam Full Moon Poya'),
  ('2026-02-04', 'Independence Day'),
  ('2026-03-03', 'Medin Full Moon Poya'),
  ('2026-04-02', 'Bak Full Moon Poya'),
  ('2026-04-03', 'Good Friday'),
  ('2026-04-13', 'Day prior to Sinhala & Tamil New Year'),
  ('2026-04-14', 'Sinhala & Tamil New Year'),
  ('2026-05-01', 'Vesak Full Moon Poya / May Day'),
  ('2026-06-29', 'Poson Full Moon Poya'),
  ('2026-07-29', 'Esala Full Moon Poya'),
  ('2026-08-27', 'Nikini Full Moon Poya'),
  ('2026-10-26', 'Vap Full Moon Poya'),
  ('2026-11-24', 'Il Full Moon Poya'),
  ('2026-12-24', 'Unduvap Full Moon Poya'),
  ('2026-12-25', 'Christmas Day');
