import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { roleHome } from './roles';
import { Alert, Button, Field } from '../components/ui';
import { BrandLogo } from '../components/BrandLogo';
import { BRAND } from '../brand';

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [clientId, setClientId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = `Sign in · ${BRAND.productName} | ${BRAND.companyShort}`;
  }, []);

  if (!loading && user) {
    return <Navigate to={roleHome(user.role)} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const u = await login(clientId.trim(), email.trim(), password);
      navigate(roleHome(u.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen-center">
      <div className="login-panel">
        <div className="login-brand">
          <BrandLogo className="login-logo" width={64} height={64} />
          <h1 className="login-product-name">{BRAND.productName}</h1>
          <p>{BRAND.productTagline} — multi-tenant GST billing for Indian enterprises</p>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            <a href="/">← Back to overview</a>
            {' · '}
            <a href="/contact">Contact</a>
            {' · '}
            <a href="/privacy">Privacy</a>
          </p>
        </div>
        {error ? <Alert>{error}</Alert> : null}
        <form className="form-stack" onSubmit={handleSubmit}>
          <Field label="Client ID" htmlFor="clientId">
            <input
              id="clientId"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="e.g. MGMHOSP or PLATFORM"
              required
              autoComplete="organization"
            />
          </Field>
          <Field label="Email" htmlFor="email">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </Field>
          <Field label="Password" htmlFor="password">
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
