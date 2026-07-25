import { useEffect, useState } from 'react';
import { integrationsApi } from '../../api';
import {
  Alert,
  Button,
  Field,
  PageHeader,
  useFormSubmit,
} from '../../components/ui';
import { Plug } from 'lucide-react';

export function IntegrationsPage() {
  const [loading, setLoading] = useState(true);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [smtpFromEmail, setSmtpFromEmail] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('');
  const [hasSmtpPass, setHasSmtpPass] = useState(false);
  const [waPhoneNumberId, setWaPhoneNumberId] = useState('');
  const [waAccessToken, setWaAccessToken] = useState('');
  const [waApiVersion, setWaApiVersion] = useState('v19.0');
  const [hasWaToken, setHasWaToken] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testMsg, setTestMsg] = useState<string | null>(null);

  useEffect(() => {
    integrationsApi
      .get()
      .then((s) => {
        setSmtpHost(s.smtpHost ?? '');
        setSmtpPort(String(s.smtpPort ?? 587));
        setSmtpUser(s.smtpUser ?? '');
        setSmtpSecure(s.smtpSecure ?? true);
        setSmtpFromEmail(s.smtpFromEmail ?? '');
        setSmtpFromName(s.smtpFromName ?? '');
        setHasSmtpPass(!!s.hasSmtpPass);
        setWaPhoneNumberId(s.waPhoneNumberId ?? '');
        setWaApiVersion(s.waApiVersion ?? 'v19.0');
        setHasWaToken(!!s.hasWaToken);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const { busy, error, success, setSuccess, handle } = useFormSubmit(async () => {
    const saved = await integrationsApi.update({
      smtpHost: smtpHost || null,
      smtpPort: Number(smtpPort) || 587,
      smtpUser: smtpUser || null,
      smtpPass: smtpPass || undefined,
      smtpSecure,
      smtpFromEmail: smtpFromEmail || null,
      smtpFromName: smtpFromName || null,
      waPhoneNumberId: waPhoneNumberId || null,
      waAccessToken: waAccessToken || undefined,
      waApiVersion: waApiVersion || 'v19.0',
    });
    setHasSmtpPass(!!saved.hasSmtpPass);
    setHasWaToken(!!saved.hasWaToken);
    setSmtpPass('');
    setWaAccessToken('');
    setSuccess('Integration settings saved.');
  });

  if (loading) return <p className="muted">Loading integrations…</p>;

  return (
    <>
      <PageHeader
        icon={<Plug size={22} />}
        title="Integrations"
        subtitle="Email (SMTP) and WhatsApp Cloud API credentials for sharing invoices"
      />

      <div className="panel">
        {error ? <Alert>{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}
        {testMsg ? <Alert variant="info">{testMsg}</Alert> : null}

        <form
          className="form-stack"
          onSubmit={(e) => {
            void handle(e);
          }}
        >
          <h2 className="panel-title">Email (SMTP)</h2>
          <div className="grid-2">
            <Field label="SMTP host" htmlFor="smtp-host">
              <input
                id="smtp-host"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.gmail.com"
              />
            </Field>
            <Field label="Port" htmlFor="smtp-port">
              <input
                id="smtp-port"
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
              />
            </Field>
            <Field label="Username" htmlFor="smtp-user">
              <input
                id="smtp-user"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
              />
            </Field>
            <Field
              label={hasSmtpPass ? 'Password (saved — leave blank to keep)' : 'Password'}
              htmlFor="smtp-pass"
            >
              <input
                id="smtp-pass"
                type="password"
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <Field label="From email" htmlFor="smtp-from">
              <input
                id="smtp-from"
                type="email"
                value={smtpFromEmail}
                onChange={(e) => setSmtpFromEmail(e.target.value)}
              />
            </Field>
            <Field label="From name" htmlFor="smtp-name">
              <input
                id="smtp-name"
                value={smtpFromName}
                onChange={(e) => setSmtpFromName(e.target.value)}
              />
            </Field>
          </div>
          <label className="field">
            <span className="field-label">
              <input
                type="checkbox"
                checked={smtpSecure}
                onChange={(e) => setSmtpSecure(e.target.checked)}
                style={{ width: 'auto', marginRight: '0.5rem' }}
              />
              Use TLS / secure connection
            </span>
          </label>

          <h2 className="panel-title">WhatsApp Cloud API</h2>
          <div className="grid-2">
            <Field label="Phone number ID" htmlFor="wa-phone">
              <input
                id="wa-phone"
                value={waPhoneNumberId}
                onChange={(e) => setWaPhoneNumberId(e.target.value)}
              />
            </Field>
            <Field label="API version" htmlFor="wa-ver">
              <input
                id="wa-ver"
                value={waApiVersion}
                onChange={(e) => setWaApiVersion(e.target.value)}
              />
            </Field>
            <Field
              label={
                hasWaToken
                  ? 'Access token (saved — leave blank to keep)'
                  : 'Access token'
              }
              htmlFor="wa-token"
            >
              <input
                id="wa-token"
                type="password"
                value={waAccessToken}
                onChange={(e) => setWaAccessToken(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
          </div>

          <div className="btn-group">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save credentials'}
            </Button>
          </div>
        </form>

        <div className="form-stack" style={{ marginTop: '1.25rem' }}>
          <h2 className="panel-title">Test email</h2>
          <div className="filter-bar">
            <Field label="Send test to" htmlFor="test-to">
              <input
                id="test-to"
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
              />
            </Field>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void integrationsApi
                  .testEmail(testTo)
                  .then(() => setTestMsg(`Test email sent to ${testTo}`))
                  .catch((e) =>
                    setTestMsg(e instanceof Error ? e.message : 'Test failed'),
                  );
              }}
            >
              Send test
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
