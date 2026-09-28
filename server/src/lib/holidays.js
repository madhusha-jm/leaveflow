// Sri Lankan public holidays that fall on weekdays — they don't count as leave days.
//
// PROVISIONAL (open question Q3 in docs/requirements.md): these 2026 dates follow the
// usual pattern (poya = full-moon day) but must be checked against the government
// gazette / Ceylon Roots HR before real use. A wrong date here silently miscounts leave.
// Weekend holidays are left out — weekends are never counted anyway.
// Not yet listed: Ramazan, Hajj, Milad-un-Nabi and Deepavali — their dates depend on
// moon sighting and are announced during the year; add them when HR confirms.
// Next step when HR owns this list: a `holidays` table they can edit, instead of code.
const HOLIDAYS = {
  2026: [
    '2026-01-15', // Tamil Thai Pongal
    '2026-02-04', // Independence Day
    '2026-02-02', // Navam Full Moon Poya (Nawam) — verify
    '2026-03-03', // Medin Full Moon Poya — verify
    '2026-04-02', // Bak Full Moon Poya — verify
    '2026-04-03', // Good Friday
    '2026-04-13', // Day prior to Sinhala & Tamil New Year
    '2026-04-14', // Sinhala & Tamil New Year
    '2026-05-01', // Vesak Full Moon Poya + May Day
    '2026-06-29', // Poson Full Moon Poya — verify
    '2026-07-29', // Esala Full Moon Poya — verify
    '2026-08-27', // Nikini Full Moon Poya — verify
    '2026-10-26', // Vap Full Moon Poya — verify
    '2026-11-24', // Il Full Moon Poya — verify
    '2026-12-24', // Unduvap Full Moon Poya — verify
    '2026-12-25', // Christmas Day
  ],
};

// All holidays in the years a request touches (a request may cross New Year).
function holidaysBetween(startDate, endDate) {
  const from = Number(startDate.slice(0, 4));
  const to = Number(endDate.slice(0, 4));
  const list = [];
  for (let y = from; y <= to; y++) list.push(...(HOLIDAYS[y] || []));
  return list;
}

module.exports = { HOLIDAYS, holidaysBetween };
