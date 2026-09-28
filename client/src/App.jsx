import { useEffect, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api.js';
import Login from './pages/Login.jsx';
import MyLeave from './pages/MyLeave.jsx';
import Approvals from './pages/Approvals.jsx';

const APPROVER_ROLES = ['MANAGER', 'HR_ADMIN'];
const ROLE_LABEL = { EMPLOYEE: 'Employee', MANAGER: 'Manager', HR_ADMIN: 'HR admin' };

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(Boolean(getToken()));
  const [page, setPage] = useState('mine');

  // Any 401 anywhere (expired token) drops the user back to the login screen.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
  }, []);

  // A token left over from last time: ask the server who it belongs to.
  useEffect(() => {
    if (!getToken()) return;
    api('/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setChecking(false));
  }, []);

  async function handleLogin(token) {
    setToken(token);
    setUser(await api('/me'));
    setPage('mine');
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  if (checking) return <p className="centered muted">Loading…</p>;
  if (!user) return <Login onLogin={handleLogin} />;

  const canApprove = APPROVER_ROLES.includes(user.role);

  return (
    <div className="app">
      <header className="topbar">
        <strong className="brand">LeaveFlow</strong>
        <nav className="tabs">
          <button className={page === 'mine' ? 'active' : ''} onClick={() => setPage('mine')}>
            My leave
          </button>
          {canApprove && (
            <button className={page === 'approvals' ? 'active' : ''} onClick={() => setPage('approvals')}>
              Approvals
            </button>
          )}
        </nav>
        <div className="who">
          <span>{user.name} <span className="muted">· {ROLE_LABEL[user.role]}</span></span>
          <button className="link" onClick={logout}>Log out</button>
        </div>
      </header>
      <main>
        {page === 'approvals' && canApprove ? <Approvals user={user} /> : <MyLeave user={user} />}
      </main>
    </div>
  );
}
