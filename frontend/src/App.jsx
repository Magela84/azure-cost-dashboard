// Root application component: resolves auth state first, then renders either
// the sign-in screen or the dashboard.

import React, { useEffect, useState } from 'react';

import Dashboard from './pages/Dashboard';
import LoginScreen from './components/LoginScreen';
import { api, AuthError } from './api';

export default function App() {
  const [auth, setAuth] = useState({ status: 'loading', profile: null, loginUrl: null });

  useEffect(() => {
    let cancelled = false;
    api
      .profile()
      .then((profile) => !cancelled && setAuth({ status: 'ok', profile }))
      .catch((err) => {
        if (cancelled) return;
        // Basic-auth mode: a refused prompt means reload to re-trigger it.
        const loginUrl = err instanceof AuthError ? err.loginUrl : null;
        setAuth({ status: 'anonymous', profile: null, loginUrl });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (auth.status === 'anonymous' && !auth.loginUrl) window.location.reload();
  }, [auth]);

  if (auth.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  if (auth.status === 'anonymous') {
    return <LoginScreen loginUrl={auth.loginUrl} />;
  }

  return <Dashboard profile={auth.profile} />;
}
