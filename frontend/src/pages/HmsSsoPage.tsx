import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { storeAuth } from '../api/client';
import type { AuthUser } from '../types';
import { roleHome } from '../auth/roles';

/**
 * Landing page for IndHMS SSO embed / deep-link.
 * Expects ?token=<signed> and exchanges it for a billing JWT.
 */
export function HmsSsoPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setError('Missing SSO token');
      return;
    }
    const apiBase = import.meta.env.VITE_API_URL ?? '/api';
    fetch(`${apiBase}/hms/auth/sso`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || 'SSO failed');
        storeAuth(data.accessToken as string, data.user as AuthUser);
        const redirect = (data.redirect as string) || roleHome(data.user.role);
        navigate(redirect, { replace: true });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'SSO failed'));
  }, [params, navigate]);

  return (
    <div className="screen-center">
      <div className="login-panel">
        <h1>Connecting to billing…</h1>
        {error ? <p className="error">{error}</p> : <p>Please wait.</p>}
      </div>
    </div>
  );
}
