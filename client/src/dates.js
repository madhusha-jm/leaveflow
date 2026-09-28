// Mirrors server/src/lib/dates.js leaveDays(): working days (Mon–Fri) inclusive.
// Only a preview — the server's number is the one that is stored.
export function workingDays(start, end) {
  if (!start || !end || end < start) return 0;
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  let n = 0;
  while (d <= last) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) n++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return n;
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
