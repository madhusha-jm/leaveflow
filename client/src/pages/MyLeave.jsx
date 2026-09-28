import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { prettyDate, todayIso, workingDays } from '../dates.js';
import StatusBadge from './StatusBadge.jsx';

// US-3 balances, US-1/US-2 apply, US-5 my requests, US-6 cancel.
export default function MyLeave({ user }) {
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    try {
      const [b, r] = await Promise.all([api('/balances'), api('/leave-requests')]);
      setBalances(b);
      // HR's list contains everyone's requests; this page is only about "mine".
      setRequests(r.filter((x) => x.user_id === user.id));
      setLoadError('');
    } catch (err) {
      setLoadError(err.message);
    }
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      {loadError && <p className="error" role="alert">{loadError}</p>}
      <section>
        <h2>My balances <span className="muted small">{new Date().getFullYear()}</span></h2>
        <div className="balances">
          {balances.map((b) => (
            <div className="card balance" key={b.leave_type_id}>
              <div className="balance-name">{b.name}</div>
              <div className="balance-num">{b.available}</div>
              <div className="muted small">
                available of {b.allocation}
                {b.pending_days > 0 && <> · <strong>{b.pending_days} pending</strong></>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <ApplyForm balances={balances} onCreated={load} />

      <section>
        <h2>My requests</h2>
        <RequestList requests={requests} onChanged={load} />
      </section>
    </>
  );
}

function ApplyForm({ balances, onCreated }) {
  const empty = { leave_type_id: '', start_date: '', end_date: '', reason: '' };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });
  const days = workingDays(form.start_date, form.end_date);
  const chosen = balances.find((b) => b.leave_type_id === Number(form.leave_type_id));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setDone('');
    setBusy(true);
    try {
      const created = await api('/leave-requests', {
        method: 'POST',
        body: { ...form, leave_type_id: Number(form.leave_type_id) },
      });
      setDone(`Request #${created.id} sent for ${created.days} day(s) — waiting for approval.`);
      setForm(empty);
      await onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>Apply for leave</h2>
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
            From
            <input type="date" value={form.start_date} min={todayIso()}
              onChange={set('start_date')} required />
          </label>
          <label>
            To
            <input type="date" value={form.end_date} min={form.start_date || todayIso()}
              onChange={set('end_date')} required />
          </label>
        </div>
        <label>
          Reason <span className="muted small">(optional)</span>
          <textarea rows="2" value={form.reason} onChange={set('reason')} maxLength={500} />
        </label>
        {form.start_date && form.end_date && (
          <p className={chosen && days > chosen.available ? 'error' : 'muted'}>
            {days} working day(s)
            {chosen && ` · ${chosen.available} ${chosen.name} day(s) available`}
          </p>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        {done && <p className="success" role="status">{done}</p>}
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Sending…' : 'Submit request'}
        </button>
      </form>
    </section>
  );
}

function RequestList({ requests, onChanged }) {
  const [error, setError] = useState('');

  async function cancel(id) {
    if (!window.confirm(`Cancel request #${id}?`)) return;
    setError('');
    try {
      await api(`/leave-requests/${id}`, { method: 'PATCH', body: { action: 'cancel' } });
      await onChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!requests.length) return <p className="muted">No requests yet.</p>;
  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      <ul className="list">
        {requests.map((r) => (
          <li className="card item" key={r.id}>
            <div className="item-main">
              <div>
                <strong>{r.leave_type}</strong> · {r.days} day(s)
                <div className="muted small">
                  {prettyDate(r.start_date)} → {prettyDate(r.end_date)}
                </div>
                {r.reason && <div className="small">{r.reason}</div>}
              </div>
              <StatusBadge status={r.status} />
            </div>
            {r.status === 'PENDING' && (
              <button className="secondary" onClick={() => cancel(r.id)}>Cancel request</button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
