// Mirrors server/src/lib/leaveDays.js: working days inclusive, weekends and the
// given holiday dates ('YYYY-MM-DD') excluded. Only a preview — the server's number is stored.
export function workingDays(start, end, holidays = []) {
  if (!start || !end || end < start) return 0;
  const skip = new Set(holidays);
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  let n = 0;
  while (d <= last) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6 && !skip.has(d.toISOString().slice(0, 10))) n++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return n;
}

// The dates of a request, with the half for a half day (US-15):
// "Mon 9 Mar 2026 · morning" or "Mon 9 Mar 2026 → Fri 13 Mar 2026"
export function requestDates(r) {
  if (r.day_part && r.day_part !== 'FULL') return `${prettyDate(r.start_date)} · ${r.day_part.toLowerCase()}`;
  return `${prettyDate(r.start_date)} → ${prettyDate(r.end_date)}`;
}

// "2026-10-05" -> "Mon 5 Oct 2026"
export function prettyDate(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

export function todayIso() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
