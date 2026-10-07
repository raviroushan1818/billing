import { useEffect, useState } from 'react';
import { platformApi } from '../../api';
import type { BusinessProfile, PlatformSettings, Tenant } from '../../types';
import {
  Alert,
  Button,
  DataTable,
  Field,
  PageHeader,
  StatusBadge,
  useFormSubmit,
} from '../../components/ui';

const PROFILE_TYPES: BusinessProfile[] = [
  'HOSPITAL',
  'SCHOOL',
  'COMMERCIAL',
  'CLINIC',
  'RETAIL',
  'GENERIC',
];

export function ClientsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showFormat, setShowFormat] = useState(false);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);

  const [name, setName] = useState('');
  const [profileType, setProfileType] = useState<BusinessProfile>('GENERIC');
  const [customClientId, setCustomClientId] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');

  const [prefix, setPrefix] = useState('CLI');
  const [separator, setSeparator] = useState('-');
  const [suffixLength, setSuffixLength] = useState(8);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editClientId, setEditClientId] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  const load = () => {
    setLoading(true);
    platformApi
      .listTenants()
      .then(setTenants)
      .catch(() => setTenants([]))
      .finally(() => setLoading(false));
  };

  const loadSettings = () => {
    void platformApi
      .getSettings()
      .then((s) => {
        setSettings(s);
        setPrefix(s.clientIdPrefix);
        setSeparator(s.clientIdSeparator);
        setSuffixLength(s.clientIdSuffixLength);
      })
      .catch(() => setSettings(null));
  };

  useEffect(() => {
    load();
    loadSettings();
  }, []);

  const { busy, error, success, setSuccess, handle } = useFormSubmit(async () => {
    const created = await platformApi.createTenant({
      name,
      profileType,
      adminEmail,
      adminPassword,
      adminFirstName,
      adminLastName,
      clientId: customClientId.trim() || undefined,
    });
    setCreatedClientId(created.clientId);
    setSuccess(`Client "${created.name}" created.`);
    setName('');
    setCustomClientId('');
    setAdminEmail('');
    setAdminPassword('');
    setAdminFirstName('');
    setAdminLastName('');
    load();
  });

  const formatSubmit = useFormSubmit(async () => {
    const updated = await platformApi.updateSettings({
      clientIdPrefix: prefix.trim().toUpperCase(),
      clientIdSeparator: separator,
      clientIdSuffixLength: suffixLength,
    });
    setSettings(updated);
    setPrefix(updated.clientIdPrefix);
    setSeparator(updated.clientIdSeparator);
    setSuffixLength(updated.clientIdSuffixLength);
  });

  const toggleStatus = async (t: Tenant) => {
    const next = t.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await platformApi.updateTenantStatus(t.id, next);
    load();
  };

  const startEditClientId = (t: Tenant) => {
    if (t.clientId === 'PLATFORM') return;
    setEditingId(t.id);
    setEditClientId(t.clientId);
    setEditError(null);
  };

  const saveClientId = async (t: Tenant) => {
    setEditBusy(true);
    setEditError(null);
    try {
      await platformApi.updateTenantClientId(t.id, editClientId.trim());
      setEditingId(null);
      load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update Client ID');
    } finally {
      setEditBusy(false);
    }
  };

  const previewSample =
    `${prefix.trim().toUpperCase() || 'CLI'}${separator}${'X'.repeat(Math.min(16, Math.max(4, suffixLength)))}`;

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Manage tenant organizations on the platform"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowFormat((v) => !v)}>
              {showFormat ? 'Hide format' : 'Client ID format'}
            </Button>
            <Button onClick={() => setShowForm((v) => !v)}>
              {showForm ? 'Hide form' : 'New client'}
            </Button>
          </>
        }
      />

      {showFormat ? (
        <div className="panel">
          <h2 className="panel-title">Client ID format</h2>
          <p className="muted">
            Controls how new Client IDs are auto-generated. Existing clients keep their current IDs
            unless you edit them individually.
          </p>
          {formatSubmit.error ? <Alert>{formatSubmit.error}</Alert> : null}
          {formatSubmit.success ? (
            <Alert variant="success">{formatSubmit.success}</Alert>
          ) : null}
          <form
            className="form-stack"
            onSubmit={(e) => {
              void formatSubmit.handle(e);
            }}
          >
            <div className="grid-3">
              <Field label="Prefix" htmlFor="cid-prefix">
                <input
                  id="cid-prefix"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                  maxLength={12}
                  pattern="[A-Za-z0-9]+"
                  required
                  placeholder="CLI"
                />
              </Field>
              <Field label="Separator" htmlFor="cid-sep">
                <select
                  id="cid-sep"
                  value={separator}
                  onChange={(e) => setSeparator(e.target.value)}
                >
                  <option value="-">Hyphen (-)</option>
                  <option value="_">Underscore (_)</option>
                  <option value="">None</option>
                </select>
              </Field>
              <Field label="Suffix length" htmlFor="cid-len">
                <input
                  id="cid-len"
                  type="number"
                  min={4}
                  max={16}
                  value={suffixLength}
                  onChange={(e) => setSuffixLength(Number(e.target.value) || 8)}
                  required
                />
              </Field>
            </div>
            <p className="muted">
              Preview pattern: <code>{previewSample}</code>
              {settings?.sampleClientId ? (
                <>
                  {' '}
                  · Last sample: <code>{settings.sampleClientId}</code>
                </>
              ) : null}
            </p>
            <Button type="submit" disabled={formatSubmit.busy}>
              {formatSubmit.busy ? 'Saving…' : 'Save format'}
            </Button>
          </form>
        </div>
      ) : null}

      {showForm ? (
        <div className="panel">
          <h2 className="panel-title">Create client</h2>
          {error ? <Alert>{error}</Alert> : null}
          {success ? <Alert variant="success">{success}</Alert> : null}
          {createdClientId ? (
            <div className="client-id-banner">
              Client ID: <strong>{createdClientId}</strong>
              <p className="muted" style={{ margin: '0.5rem 0 0', fontFamily: 'inherit' }}>
                Share this ID with the client for login.
              </p>
            </div>
          ) : null}
          <form
            className="form-stack"
            onSubmit={(e) => {
              void handle(e);
            }}
          >
            <div className="grid-2">
              <Field label="Organization name" htmlFor="c-name">
                <input
                  id="c-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </Field>
              <Field label="Profile type" htmlFor="c-profile">
                <select
                  id="c-profile"
                  value={profileType}
                  onChange={(e) =>
                    setProfileType(e.target.value as BusinessProfile)
                  }
                >
                  {PROFILE_TYPES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Client ID (optional)"
                htmlFor="c-client-id"
                hint={
                  settings
                    ? `Leave blank to auto-generate (e.g. ${settings.sampleClientId})`
                    : 'Leave blank to auto-generate'
                }
              >
                <input
                  id="c-client-id"
                  value={customClientId}
                  onChange={(e) => setCustomClientId(e.target.value.toUpperCase())}
                  placeholder={settings?.sampleClientId ?? 'CLI-XXXXXXXX'}
                  maxLength={32}
                  pattern="[A-Za-z0-9][A-Za-z0-9_-]*"
                />
              </Field>
            </div>
            <h3>Admin user</h3>
            <div className="grid-2">
              <Field label="First name" htmlFor="c-fn">
                <input
                  id="c-fn"
                  value={adminFirstName}
                  onChange={(e) => setAdminFirstName(e.target.value)}
                  required
                />
              </Field>
              <Field label="Last name" htmlFor="c-ln">
                <input
                  id="c-ln"
                  value={adminLastName}
                  onChange={(e) => setAdminLastName(e.target.value)}
                  required
                />
              </Field>
              <Field label="Email" htmlFor="c-email">
                <input
                  id="c-email"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                />
              </Field>
              <Field label="Password" htmlFor="c-pass">
                <input
                  id="c-pass"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </Field>
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create client'}
            </Button>
          </form>
        </div>
      ) : null}

      <div className="panel">
        <h2 className="panel-title">All clients</h2>
        {editError ? <Alert>{editError}</Alert> : null}
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <DataTable
            columns={[
              { key: 'clientId', label: 'Client ID' },
              { key: 'name', label: 'Name' },
              { key: 'profile', label: 'Profile' },
              { key: 'plan', label: 'Plan' },
              { key: 'status', label: 'Status' },
              { key: 'actions', label: '' },
            ]}
            rows={tenants.map((t) => ({
              id: t.id,
              cells: {
                clientId:
                  editingId === t.id ? (
                    <span className="inline-edit-row">
                      <input
                        value={editClientId}
                        onChange={(e) => setEditClientId(e.target.value.toUpperCase())}
                        maxLength={32}
                        disabled={editBusy}
                        style={{ width: '10rem', fontFamily: 'ui-monospace, monospace' }}
                      />
                      <Button
                        variant="secondary"
                        disabled={editBusy || !editClientId.trim()}
                        onClick={() => void saveClientId(t)}
                      >
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={editBusy}
                        onClick={() => {
                          setEditingId(null);
                          setEditError(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </span>
                  ) : (
                    <span className="inline-edit-row">
                      <code>{t.clientId}</code>
                      {t.clientId !== 'PLATFORM' ? (
                        <Button
                          variant="ghost"
                          onClick={() => startEditClientId(t)}
                        >
                          Edit
                        </Button>
                      ) : null}
                    </span>
                  ),
                name: t.name,
                profile: t.profileType,
                plan: t.planCode ?? '—',
                status: <StatusBadge status={t.status} />,
                actions: (
                  <Button variant="secondary" onClick={() => void toggleStatus(t)}>
                    {t.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                  </Button>
                ),
              },
            }))}
          />
        )}
      </div>
    </>
  );
}
