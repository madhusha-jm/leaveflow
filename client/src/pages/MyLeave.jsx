import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { prettyDate } from '../dates.js';
import ApplyLeaveForm from '../components/ApplyLeaveForm.jsx';
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

  async function apply(payload) {
    const created = await api('/leave-requests', { method: 'POST', body: payload });
    await load(); // balances now show the new pending days
    return created;
  }

  return (
    <>
      {loadError && <p className="error" role="alert">{loadError}</p>}
      <section>
        <h2>My balances <span className="muted small">{new Date().getFullYear()}</span></h2>
        <div className="balances">
          {balances.map((b) => (
            <div className="card balance" key={b.leave_type_id} role="group" aria-label={`${b.name} balance`}>
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

      <section>
        <h2>Apply for leave</h2>
        <ApplyLeaveForm balances={balances} onSubmit={apply} />
      </section>

      <section>
        <h2>My requests</h2>
        <RequestList requests={requests} onChanged={load} />
      </section>
    </>
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
