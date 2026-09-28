import { useState } from 'react';
import { todayIso, workingDays } from '../dates.js';

const EMPTY = { leave_type_id: '', start_date: '', end_date: '', reason: '' };
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// The apply form on its own, so it can be tested without a server:
//   balances  — rows from GET /api/balances (fills the leave-type list)
//   onSubmit  — async (payload) => created request; throw an Error to show its message
export default function ApplyLeaveForm({ balances = [], onSubmit }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const datesValid = ISO_DATE.test(form.start_date) && ISO_DATE.test(form.end_date)
    && form.end_date >= form.start_date;
  const days = datesValid ? workingDays(form.start_date, form.end_date) : 0;
  const chosen = balances.find((b) => b.leave_type_id === Number(form.leave_type_id));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setDone('');
    setBusy(true);
    try {
      const created = await onSubmit({ ...form, leave_type_id: Number(form.leave_type_id) });
      setDone(created
        ? `Request #${created.id} sent for ${created.days} day(s) — waiting for approval.`
        : 'Request sent — waiting for approval.');
      setForm(EMPTY);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card apply" onSubmit={submit}>
      <label>
        Leave type
        <select value={form.leave_type_id} onChange={set('leave_type_id')} required>
          <option value="" disabled>Choose…</option>
          {balances.map((b) => (
            <option key={b.leave_type_id} value={b.leave_type_id}>
              {b.name} ({b.available} available)
            </option>
          ))}
        </select>
      </label>
      <div className="row">
        <label>
          Start date
          <input type="date" value={form.start_date} min={todayIso()}
            onChange={set('start_date')} required />
        </label>
        <label>
          End date
          <input type="date" value={form.end_date} min={form.start_date || todayIso()}
            onChange={set('end_date')} required />
        </label>
      </div>
      <label>
        Reason <span className="muted small">(optional)</span>
        <textarea rows="2" value={form.reason} onChange={set('reason')} maxLength={500} />
      </label>
      {form.start_date && form.end_date && !datesValid && (
        <p className="error">End date must be on or after the start date.</p>
      )}
      {datesValid && (
        <p className={chosen && days > chosen.available ? 'error' : 'muted'}>
          {days} working day(s)
          {chosen && ` · ${chosen.available} ${chosen.name} day(s) available`}
        </p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      {done && <p className="success" role="status">{done}</p>}
      <button type="submit" className="primary" disabled={busy || !datesValid}>
        {busy ? 'Sending…' : 'Apply'}
      </button>
    </form>
  );
}
