// The exact journey that failed in Nadeesha's demo: employee applies,
// manager approves, the employee sees APPROVED and the right balance.
const { test, expect } = require('@playwright/test');
const { holidaysBetween } = require('../server/src/lib/holidays');

// The form refuses past dates, so pick a real future week: the Monday at least
// 14 days from today, through that Friday.
function upcomingWeek() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1); // 1 = Monday
  const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const start = iso(d);
  d.setDate(d.getDate() + 4);
  return { start, end: iso(d) };
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

test('employee applies, manager approves, status shows Approved', async ({ page }) => {
  const { start, end } = upcomingWeek();
  // Mon–Fri is 5 days, minus any holiday that week. Counted here, independently —
  // borrowing the server's leaveDays() would make the test share its bugs.
  const days = 5 - holidaysBetween(start, end).filter((h) => h >= start && h <= end).length;
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
