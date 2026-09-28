import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { prettyDate } from '../dates.js';

// US-7 approval inbox, US-8 approve/reject, US-4 see the balance before deciding.
export default function Approvals({ user }) {
  const [requests, setRequests] = useState([]);
  const [balances, setBalances] = useState({}); // user_id -> that person's balance rows
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await api('/team/requests');
      setRequests(rows);
      const ids = [...new Set(rows.map((r) => r.user_id))];
      const lists = await Promise.all(ids.map((id) => api(`/balances?user_id=${id}`)));
      setBalances(Object.fromEntries(ids.map((id, i) => [id, lists[i]])));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function decide(id, action) {
    setError('');
    setBusyId(id);
    try {
      await api(`/leave-requests/${id}`, { method: 'PATCH', body: { action } });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <h2>
        Waiting for your decision
        <span className="muted small"> · {user.role === 'HR_ADMIN' ? 'all teams' : 'your team'}</span>
      </h2>
      {error && <p className="error" role="alert">{error}</p>}
      {loaded && !requests.length && <p className="muted">Nothing waiting for you.</p>}
      <ul className="list">
        {requests.map((r) => {
          const bal = balances[r.user_id]?.find((b) => b.leave_type_id === r.leave_type_id);
          return (
            <li className="card item" key={r.id}>
              <div>
                <strong>{r.employee_name}</strong> · {r.leave_type} · {r.days} day(s)
                <div className="muted small">
                  {prettyDate(r.start_date)} → {prettyDate(r.end_date)}
                </div>
                {r.reason && <div className="small">"{r.reason}"</div>}
                {bal && (
                  // Pending days are already reserved, so "available" is what is
                  // left even if every pending request (this one included) is approved.
                  <div className="small balance-hint">
                    {bal.name}: {bal.available} of {bal.allocation} left after this ·{' '}
                    {bal.pending_days} pending in total
                  </div>
                )}
              </div>
              <div className="actions">
                <button className="primary" disabled={busyId === r.id}
                  onClick={() => decide(r.id, 'approve')}>Approve</button>
                <button className="danger" disabled={busyId === r.id}
                  onClick={() => decide(r.id, 'reject')}>Reject</button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
