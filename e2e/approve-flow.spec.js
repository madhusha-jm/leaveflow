// The exact journey that failed in Nadeesha's demo: employee applies,
// manager approves, the employee sees APPROVED and the right balance —
// plus the capstone journeys: HR adds a holiday, and an employee books a half day.
const { test, expect } = require('@playwright/test');

const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;

// The form refuses past dates, so pick a real future week: the Monday at least
// 14 days from today (plus `weeksLater` weeks), and its five weekdays.
function upcomingWeek(weeksLater = 0) {
  const d = new Date();
  d.setDate(d.getDate() + 14 + 7 * weeksLater);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1); // 1 = Monday
  return Array.from({ length: 5 }, (_, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    return iso(day);
  });
}

// The holiday dates the API knows for the years these dates fall in.
async function holidayDates(request, dates) {
  const login = await request.post('/api/auth/login',
    { data: { email: 'ishara@ceylonroots.lk', password: 'password123' } });
  const { token } = await login.json();
  const years = [...new Set(dates.map((d) => d.slice(0, 4)))];
  const lists = await Promise.all(years.map(async (y) =>
    (await request.get(`/api/holidays?year=${y}`, { headers: { Authorization: `Bearer ${token}` } })).json()));
  return lists.flat().map((h) => h.date);
}

async function login(page, email) {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
}

async function logout(page) {
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
}

test('employee applies, manager approves, status shows Approved', async ({ page, request }) => {
  const week = upcomingWeek();
  const [start, end] = [week[0], week[4]];
  // Mon–Fri is 5 days, minus any holiday that week. Counted here, independently —
  // borrowing the server's leaveDays() would make the test share its bugs.
  const holidays = await holidayDates(request, week);
  const days = week.filter((d) => !holidays.includes(d)).length;
  // The dashboard shows this year's balances; a request next year doesn't touch them.
  const sameYear = Number(start.slice(0, 4)) === new Date().getFullYear();
  const annualCard = page.getByRole('group', { name: 'Annual balance' });

  // 1. Ishara applies
  await login(page, 'ishara@ceylonroots.lk');
  await expect(annualCard.getByText('14', { exact: true })).toBeVisible();
  await page.getByLabel('Leave type').selectOption({ label: 'Annual (14 available)' });
  await page.getByLabel('Start date').fill(start);
  await page.getByLabel('End date').fill(end);
  await page.getByLabel('Reason').fill('Family trip');
  await page.getByRole('button', { name: 'Apply' }).click();

  await expect(page.getByRole('status')).toContainText(`sent for ${days} day(s)`);
  const myRequest = page.getByRole('listitem').filter({ hasText: 'Family trip' });
  await expect(myRequest).toContainText('PENDING');
  if (sameYear) {
    await expect(annualCard.getByText(String(14 - days), { exact: true })).toBeVisible();
    await expect(annualCard).toContainText(`${days} pending`);
  }
  await logout(page);

  // 2. Ruwan, her manager, approves
  await login(page, 'ruwan@ceylonroots.lk');
  await page.getByRole('button', { name: 'Approvals' }).click();
  const inboxItem = page.getByRole('listitem').filter({ hasText: 'Ishara Fernando' });
  await expect(inboxItem).toContainText(`${days} day(s)`);
  await inboxItem.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Nothing waiting for you.')).toBeVisible();
  await logout(page);

  // 3. Ishara sees it approved — and the balance Nadeesha's MD asked about
  await login(page, 'ishara@ceylonroots.lk');
  await expect(myRequest).toContainText('APPROVED');
  if (sameYear) {
    await expect(annualCard.getByText(String(14 - days), { exact: true })).toBeVisible();
    await expect(annualCard).not.toContainText('pending');
  }
});

test('HR adds a holiday, and it is not charged (US-17, US-18)', async ({ page, request }) => {
  const week = upcomingWeek(1); // the week after the first test's, so they don't overlap
  const existing = await holidayDates(request, week);
  const newHoliday = week.find((d) => !existing.includes(d)); // a weekday that isn't one yet
  const days = week.filter((d) => !existing.includes(d) && d !== newHoliday).length;

  // 1. Dilini (HR) adds it on the Holidays page
  await login(page, 'dilini@ceylonroots.lk');
  await page.getByRole('button', { name: 'Holidays' }).click();
  await page.getByLabel('Date').fill(newHoliday);
  await page.getByLabel('Name').fill('Company anniversary');
  await page.getByRole('button', { name: 'Add holiday' }).click();
  await expect(page.getByRole('status')).toContainText('Added Company anniversary');
  await expect(page.getByRole('listitem').filter({ hasText: 'Company anniversary' })).toBeVisible();
  await logout(page);

  // 2. Ishara books that week: the form names the holiday and the server skips it
  await login(page, 'ishara@ceylonroots.lk');
  await page.getByLabel('Leave type').selectOption({ index: 2 }); // Casual
  await page.getByLabel('Start date').fill(week[0]);
  await page.getByLabel('End date').fill(week[4]);
  await expect(page.getByText(/Not charged: .*Company anniversary/)).toBeVisible();
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('status')).toContainText(`sent for ${days} day(s)`);
});

test('an employee books a morning off and the manager sees which half (US-15, US-16)', async ({ page, request }) => {
  const week = upcomingWeek(2);
  const holidays = await holidayDates(request, week);
  const date = week.find((d) => !holidays.includes(d));

  await login(page, 'ishara@ceylonroots.lk');
  await page.getByLabel('Leave type').selectOption({ index: 1 }); // Annual
  await page.getByLabel('Length').selectOption('MORNING');
  await expect(page.getByLabel('End date')).toHaveCount(0); // one date only
  await page.getByLabel('Date', { exact: true }).fill(date);
  await page.getByLabel('Reason').fill('Bank appointment');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('status')).toContainText('sent for 0.5 day(s)');
  await expect(page.getByRole('listitem').filter({ hasText: 'Bank appointment' })).toContainText('morning');
  await logout(page);

  await login(page, 'ruwan@ceylonroots.lk');
  await page.getByRole('button', { name: 'Approvals' }).click();
  const inboxItem = page.getByRole('listitem').filter({ hasText: 'Bank appointment' });
  await expect(inboxItem).toContainText('0.5 day(s)');
  await expect(inboxItem).toContainText('morning');
});
