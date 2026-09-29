import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';

// A fake server: App thinks a token is stored and asks /me who it belongs to.
const me = { current: null };
vi.mock('./api.js', () => ({
  getToken: () => 'fake-token',
  setToken: () => {},
  setUnauthorizedHandler: () => {},
  api: async (path) => {
    if (path === '/me') return me.current;
    if (path === '/balances') return [];
    return []; // /leave-requests, /team/requests
  },
}));
const { default: App } = await import('./App.jsx');

describe('App top bar', () => {
  beforeEach(() => { me.current = null; });

  test('an employee sees no tab bar — there is only one page (issue #27)', async () => {
    me.current = { id: 2, name: 'Ishara Fernando', role: 'EMPLOYEE' };
    render(<App />);
    expect(await screen.findByText('Ishara Fernando')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'My leave' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approvals' })).not.toBeInTheDocument();
  });

  test('a manager sees both tabs', async () => {
    me.current = { id: 1, name: 'Ruwan Silva', role: 'MANAGER' };
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Approvals' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My leave' })).toBeInTheDocument();
  });
});
