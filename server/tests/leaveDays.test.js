const { leaveDays } = require('../src/lib/leaveDays');
const { holidaysBetween } = require('../src/lib/holidays');

// March 2026: Mon 2 … Fri 6, Sat 7, Sun 8, Mon 9.
describe('leaveDays', () => {
  test('counts a normal Mon-Fri span as 5 days', () => {
    expect(leaveDays('2026-03-02', '2026-03-06')).toBe(5);
  });

  test('counts a single working day as 1', () => {
    expect(leaveDays('2026-03-04', '2026-03-04')).toBe(1);
  });

  test('excludes the weekend in a Fri-Mon span', () => {
    expect(leaveDays('2026-03-06', '2026-03-09')).toBe(2);
  });

  test('counts a weekend-only span as 0', () => {
    expect(leaveDays('2026-03-07', '2026-03-08')).toBe(0);
  });

  test('counts two full weeks as 10 days', () => {
    expect(leaveDays('2026-03-02', '2026-03-13')).toBe(10);
  });

  test('counts across a month end (Thu 30 Apr - Tue 5 May) as 4 days', () => {
    expect(leaveDays('2026-04-30', '2026-05-05')).toBe(4);
  });

  test('counts across New Year (Wed 31 Dec 2025 - Fri 2 Jan 2026) as 3 days', () => {
    expect(leaveDays('2025-12-31', '2026-01-02')).toBe(3);
  });

  test('throws when end is before start', () => {
    expect(() => leaveDays('2026-03-06', '2026-03-02')).toThrow(
      'end_date must not be before start_date'
    );
  });

  test('throws on a date that is not a date', () => {
    expect(() => leaveDays('not-a-date', '2026-03-02')).toThrow('Invalid date');
  });

  describe('with holidays', () => {
    test('excludes Vesak poya from a spanning request', () => {
      const holidays = ['2026-05-01']; // Vesak poya
      // Wed 29 Apr, Thu 30 Apr, [Fri 1 May holiday], Sat, Sun, Mon 4 May
      expect(leaveDays('2026-04-29', '2026-05-04', holidays)).toBe(3);
    });

    test('a holiday on a weekend is not subtracted twice', () => {
      expect(leaveDays('2026-03-06', '2026-03-09', ['2026-03-07'])).toBe(2);
    });

    test('a single-day request on a holiday counts as 0', () => {
      expect(leaveDays('2026-05-01', '2026-05-01', ['2026-05-01'])).toBe(0);
    });
  });
});

describe('holidaysBetween', () => {
  test('includes Vesak 2026, so the routes exclude it', () => {
    expect(holidaysBetween('2026-04-29', '2026-05-04')).toContain('2026-05-01');
  });

  test('covers both years when a request crosses New Year', () => {
    const list = holidaysBetween('2026-12-28', '2027-01-05');
    expect(list).toContain('2026-12-25');
  });

  test('returns an empty list for a year with no data yet', () => {
    expect(holidaysBetween('2030-03-02', '2030-03-06')).toEqual([]);
  });

  test('the Vesak week really is 3 working days end to end', () => {
    const [start, end] = ['2026-04-29', '2026-05-04'];
    expect(leaveDays(start, end, holidaysBetween(start, end))).toBe(3);
  });
});
