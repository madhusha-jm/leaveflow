import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import ApplyLeaveForm from './ApplyLeaveForm';

const BALANCES = [
  { leave_type_id: 1, name: 'Annual', allocation: 14, available: 14, pending_days: 0 },
  { leave_type_id: 3, name: 'Sick', allocation: 7, available: 7, pending_days: 0 },
];

describe('ApplyLeaveForm', () => {
  // The date inputs refuse past dates (min = today), just like a real browser.
  // Pin "today" to 15 Jan 2026 so these March 2026 dates are always in the future.
  // Only Date is faked — real timers keep user-event working.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-15T09:00:00'));
  });
  afterEach(() => vi.useRealTimers());

  test('submit stays disabled until both dates are valid', async () => {
    const user = userEvent.setup();
    render(<ApplyLeaveForm onSubmit={() => {}} />);

    const submit = screen.getByRole('button', { name: /apply/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/start date/i), '2026-03-02');
    expect(submit).toBeDisabled(); // end date still missing

    await user.type(screen.getByLabelText(/end date/i), '2026-03-06');
    expect(submit).toBeEnabled();
  });

  test('stays disabled and explains when the end date is before the start date', async () => {
    const user = userEvent.setup();
    render(<ApplyLeaveForm onSubmit={() => {}} />);

    await user.type(screen.getByLabelText(/start date/i), '2026-03-06');
    await user.type(screen.getByLabelText(/end date/i), '2026-03-02');

    expect(screen.getByRole('button', { name: /apply/i })).toBeDisabled();
    expect(screen.getByText(/end date must be on or after/i)).toBeInTheDocument();
  });

  test('previews the working days against the chosen balance', async () => {
    const user = userEvent.setup();
    render(<ApplyLeaveForm balances={BALANCES} onSubmit={() => {}} />);

    await user.selectOptions(screen.getByLabelText(/leave type/i), 'Annual (14 available)');
    await user.type(screen.getByLabelText(/start date/i), '2026-03-06'); // Friday
    await user.type(screen.getByLabelText(/end date/i), '2026-03-09'); // Monday

    expect(screen.getByText(/2 working day\(s\) · 14 Annual day\(s\) available/)).toBeInTheDocument();
  });

  test('sends the typed request and confirms it', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ id: 7, days: 5 });
    render(<ApplyLeaveForm balances={BALANCES} onSubmit={onSubmit} />);

    await user.selectOptions(screen.getByLabelText(/leave type/i), 'Sick (7 available)');
    await user.type(screen.getByLabelText(/start date/i), '2026-03-09');
    await user.type(screen.getByLabelText(/end date/i), '2026-03-13');
    await user.type(screen.getByLabelText(/reason/i), 'Flu');
    await user.click(screen.getByRole('button', { name: /apply/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      leave_type_id: 3, day_part: 'FULL', start_date: '2026-03-09', end_date: '2026-03-13', reason: 'Flu',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Request #7 sent for 5 day(s)');
    expect(screen.getByLabelText(/start date/i)).toHaveValue(''); // form cleared for the next one
  });

  test("shows the server's message when the request is refused", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(
      new Error('only 2 Annual day(s) available; this request needs 5'));
    render(<ApplyLeaveForm balances={BALANCES} onSubmit={onSubmit} />);

    await user.selectOptions(screen.getByLabelText(/leave type/i), 'Annual (14 available)');
    await user.type(screen.getByLabelText(/start date/i), '2026-03-09');
    await user.type(screen.getByLabelText(/end date/i), '2026-03-13');
    await user.click(screen.getByRole('button', { name: /apply/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('only 2 Annual day(s) available');
    expect(screen.getByLabelText(/start date/i)).toHaveValue('2026-03-09'); // kept, so they can fix it
  });

  describe('half days (US-15)', () => {
    test('a morning asks for one date and sends it as start and end', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn().mockResolvedValue({ id: 8, days: 0.5 });
      render(<ApplyLeaveForm balances={BALANCES} onSubmit={onSubmit} />);

      await user.selectOptions(screen.getByLabelText(/leave type/i), 'Annual (14 available)');
      await user.selectOptions(screen.getByLabelText(/length/i), 'Morning only (½ day)');
      expect(screen.queryByLabelText(/end date/i)).not.toBeInTheDocument();

      await user.type(screen.getByLabelText(/^date/i), '2026-03-09');
      expect(screen.getByText(/0.5 working day\(s\) · 14 Annual day\(s\) available/)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /apply/i }));

      expect(onSubmit).toHaveBeenCalledWith({
        leave_type_id: 1, day_part: 'MORNING', start_date: '2026-03-09', end_date: '2026-03-09', reason: '',
      });
      expect(await screen.findByRole('status')).toHaveTextContent('Request #8 sent for 0.5 day(s)');
    });
  });

  describe('holidays in the preview (US-18)', () => {
    const HOLIDAYS = [{ date: '2026-05-01', name: 'Vesak Full Moon Poya' }];

    test('leaves a holiday out of the count and names it', async () => {
      const user = userEvent.setup();
      render(<ApplyLeaveForm balances={BALANCES} holidays={HOLIDAYS} onSubmit={() => {}} />);

      await user.type(screen.getByLabelText(/start date/i), '2026-04-29'); // Wed
      await user.type(screen.getByLabelText(/end date/i), '2026-05-04'); // Mon

      expect(screen.getByText(/^3 working day\(s\)/)).toBeInTheDocument();
      expect(screen.getByText(/Not charged: Vesak Full Moon Poya \(Fri,? 1 May 2026\)/)).toBeInTheDocument();
    });

    test('a half day on a holiday explains and cannot be sent', async () => {
      const user = userEvent.setup();
      render(<ApplyLeaveForm balances={BALANCES} holidays={HOLIDAYS} onSubmit={() => {}} />);

      await user.selectOptions(screen.getByLabelText(/length/i), 'Afternoon only (½ day)');
      await user.type(screen.getByLabelText(/^date/i), '2026-05-01');

      expect(screen.getByText(/only weekends or public holidays/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /apply/i })).toBeDisabled();
    });
  });
});
