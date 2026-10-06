import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { prettyDate } from '../dates.js';

// US-17: HR keeps the public-holiday calendar — no developer, no redeploy (issue #26).
// Only shown to HR_ADMIN; the API refuses everyone else with 403 anyway.
export default function Holidays() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState([]);
  const [form, setForm] = useState({ date: '', name: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      setHolidays(await api(`/holidays?year=${year}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoaded(true);
    }
  }, [year]);

  // load() sets state only after awaiting the API (asynchronously), so this is the
  // normal fetch-on-mount pattern, not the synchronous cascading render the rule targets.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function add(e) {
    e.preventDefault();
    setError('');
    setDone('');
    setBusy(true);
    try {
      const saved = await api('/holidays', { method: 'POST', body: form });
      setDone(`Added ${saved.name} on ${prettyDate(saved.date)}.`);
      setForm({ date: '', name: '' });
      const savedYear = Number(saved.date.slice(0, 4));
      if (savedYear === year) await load();
      else setYear(savedYear); // jump to the year just added to — load() follows
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(h) {
    if (!window.confirm(`Remove ${h.name} (${prettyDate(h.date)})? Requests already made keep their day count.`)) return;
    setError('');
    setDone('');
    try {
      await api(`/holidays/${h.date}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <section>
        <h2>Add a public holiday</h2>
        <form className="card apply" onSubmit={add}>
          <div className="row">
            <label>
              Date
              <input type="date" value={form.date} required
                onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </label>
            <label>
              Name
              <input type="text" value={form.name} required maxLength={100}
                placeholder="e.g. Duruthu Full Moon Poya"
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
          </div>
          {error && <p className="error" role="alert">{error}</p>}
          {done && <p className="success" role="status">{done}</p>}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Saving…' : 'Add holiday'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="year-head">
          Holidays in
          <button className="secondary" aria-label="Previous year" onClick={() => setYear(year - 1)}>‹</button>
          <span>{year}</span>
          <button className="secondary" aria-label="Next year" onClick={() => setYear(year + 1)}>›</button>
        </h2>
        {loaded && !holidays.length && (
          <p className="error">
            No holidays for {year} yet — nobody can book leave in {year} until they are added.
          </p>
        )}
        <ul className="list">
          {holidays.map((h) => (
            <li className="card item" key={h.date}>
              <div>
                <strong>{h.name}</strong>
                <div className="muted small">{prettyDate(h.date)}</div>
              </div>
              <div className="actions">
                <button className="danger" onClick={() => remove(h)}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
