import { useEffect, useState } from 'react';
import { platformApi } from '../../api';
import type { BusinessProfile, Tenant } from '../../types';
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
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [profileType, setProfileType] = useState<BusinessProfile>('GENERIC');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');

  const load = () => {
    setLoading(true);
    platformApi
      .listTenants()
      .then(setTenants)
      .catch(() => setTenants([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const { busy, error, success, setSuccess, handle } = useFormSubmit(async () => {
    const created = await platformApi.createTenant({
      name,
      profileType,
      adminEmail,
      adminPassword,
      adminFirstName,
      adminLastName,
    });
    setCreatedClientId(created.clientId);
    setSuccess(`Client "${created.name}" created.`);
    setName('');
    setAdminEmail('');
    setAdminPassword('');
    setAdminFirstName('');
    setAdminLastName('');
    load();
  });

  const toggleStatus = async (t: Tenant) => {
    const next = t.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    await platformApi.updateTenantStatus(t.id, next);
    load();
  };

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Manage tenant organizations on the platform"
        actions={
          <Button onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Hide form' : 'New client'}
          </Button>
        }
      />

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
                clientId: <code>{t.clientId}</code>,
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
