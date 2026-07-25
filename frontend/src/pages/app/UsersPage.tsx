import { useEffect, useMemo, useState } from 'react';
import { tenantApi } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import {
  TENANT_ASSIGNABLE_ROLES,
  roleLabel,
} from '../../auth/roles';
import type { TenantUser, UserRole } from '../../types';
import { useDialog } from '../../components/Dialog';
import {
  Alert,
  Button,
  DataTable,
  Field,
  PageHeader,
  StatusBadge,
  useFormSubmit,
} from '../../components/ui';
import { Users } from 'lucide-react';

export function UsersPage() {
  const { user: me } = useAuth();
  const dialog = useDialog();
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [activeFilter, setActiveFilter] = useState<
    '' | 'active' | 'inactive'
  >('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('BILLING_OPERATOR');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false;
      if (activeFilter === 'active' && u.isActive === false) return false;
      if (activeFilter === 'inactive' && u.isActive !== false) return false;
      if (!needle) return true;
      return (
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(needle) ||
        u.email.toLowerCase().includes(needle) ||
        (u.phone ?? '').toLowerCase().includes(needle)
      );
    });
  }, [users, q, roleFilter, activeFilter]);

  const load = () => {
    setLoading(true);
    tenantApi
      .listUsers()
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const { busy, error, success, handle } = useFormSubmit(async () => {
    await tenantApi.createUser({
      email,
      password,
      firstName,
      lastName,
      phone: phone || undefined,
      role,
    });
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setRole('BILLING_OPERATOR');
    setShowForm(false);
    load();
  });

  const toggleActive = async (u: TenantUser) => {
    const next = !u.isActive;
    const verb = next ? 'Reactivate' : 'Deactivate';
    const ok = await dialog.confirm({
      title: `${verb} user`,
      message: `${verb} ${u.firstName} ${u.lastName} (${u.email})?`,
      confirmLabel: verb,
      danger: !next,
    });
    if (!ok) return;
    try {
      setActionError(null);
      await tenantApi.updateUser(u.id, { isActive: next });
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Update failed');
    }
  };

  const changeRole = async (u: TenantUser, nextRole: UserRole) => {
    if (nextRole === u.role) return;
    const ok = await dialog.confirm({
      title: 'Change role',
      message: `Change ${u.firstName} ${u.lastName} from ${roleLabel(u.role)} to ${roleLabel(nextRole)}?`,
      confirmLabel: 'Update role',
    });
    if (!ok) return;
    try {
      setActionError(null);
      await tenantApi.updateUser(u.id, { role: nextRole });
      load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Update failed');
    }
  };

  return (
    <>
      <PageHeader
        icon={<Users size={22} />}
        title="Users & roles"
        subtitle="Owner manages Staff, Accountant, and Viewer access. Track who raises and voids bills."
        actions={
          <Button onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Hide form' : 'Add user'}
          </Button>
        }
      />

      {actionError ? <Alert>{actionError}</Alert> : null}

      {showForm ? (
        <div className="panel">
          <h2 className="panel-title">Invite team member</h2>
          {error ? <Alert>{error}</Alert> : null}
          {success ? <Alert variant="success">{success}</Alert> : null}
          <form
            className="form-stack"
            onSubmit={(e) => {
              void handle(e);
            }}
          >
            <div className="grid-2">
              <Field label="First name" htmlFor="u-fn">
                <input
                  id="u-fn"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </Field>
              <Field label="Last name" htmlFor="u-ln">
                <input
                  id="u-ln"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </Field>
              <Field label="Email" htmlFor="u-email">
                <input
                  id="u-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
              <Field label="Phone" htmlFor="u-phone">
                <input
                  id="u-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
              <Field label="Role" htmlFor="u-role">
                <select
                  id="u-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                >
                  {TENANT_ASSIGNABLE_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label} — {r.hint}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Password" htmlFor="u-pass">
                <input
                  id="u-pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </Field>
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create user'}
            </Button>
          </form>
        </div>
      ) : null}

      <div className="panel">
        <h2 className="panel-title">Team directory</h2>
        <div className="filter-bar">
          <Field label="Search" htmlFor="usr-q" className="filter-grow">
            <input
              id="usr-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, email, phone…"
            />
          </Field>
          <Field label="Role" htmlFor="usr-role">
            <select
              id="usr-role"
              value={roleFilter}
              onChange={(e) =>
                setRoleFilter(e.target.value as UserRole | '')
              }
            >
              <option value="">All roles</option>
              {TENANT_ASSIGNABLE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status" htmlFor="usr-st">
            <select
              id="usr-st"
              value={activeFilter}
              onChange={(e) =>
                setActiveFilter(e.target.value as '' | 'active' | 'inactive')
              }
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <div className="filter-bar-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setQ('');
                setRoleFilter('');
                setActiveFilter('');
              }}
            >
              Reset
            </Button>
          </div>
        </div>
        <p className="filter-meta">
          Showing {filtered.length} of {users.length} users
        </p>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <DataTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'email', label: 'Email' },
              { key: 'role', label: 'Role' },
              { key: 'status', label: 'Status' },
              { key: 'actions', label: '' },
            ]}
            rows={filtered.map((u) => ({
              id: u.id,
              cells: {
                name: `${u.firstName} ${u.lastName}`,
                email: u.email,
                role: (
                  <select
                    className="role-select"
                    value={u.role}
                    disabled={u.id === me?.id}
                    onChange={(e) =>
                      void changeRole(u, e.target.value as UserRole)
                    }
                    aria-label={`Role for ${u.firstName}`}
                  >
                    {TENANT_ASSIGNABLE_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                ),
                status: (
                  <StatusBadge
                    status={u.isActive !== false ? 'ACTIVE' : 'SUSPENDED'}
                  />
                ),
                actions: (
                  <div className="inline-actions">
                    <span className={`role-badge role-${u.role.toLowerCase()}`}>
                      {roleLabel(u.role)}
                    </span>
                    {u.id !== me?.id ? (
                      <Button
                        variant="secondary"
                        onClick={() => void toggleActive(u)}
                      >
                        {u.isActive !== false ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    ) : (
                      <span className="muted">You</span>
                    )}
                  </div>
                ),
              },
            }))}
            emptyText="No users match these filters."
          />
        )}
      </div>
    </>
  );
}
