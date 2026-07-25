import { useEffect, useMemo, useState } from 'react';
import { auditApi } from '../../api';
import {
  Alert,
  Button,
  DataTable,
  Field,
  PageHeader,
} from '../../components/ui';
import { ScrollText } from 'lucide-react';

export function AuditLogPage() {
  const [rows, setRows] = useState<
    Awaited<ReturnType<typeof auditApi.list>>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    auditApi
      .list(150)
      .then(setRows)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const actionOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.action).filter(Boolean));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (actionFilter && r.action !== actionFilter) return false;
      if (!needle) return true;
      const who = r.user
        ? `${r.user.firstName} ${r.user.lastName}`.toLowerCase()
        : '';
      const entity = [r.entityType, r.entityId].filter(Boolean).join(' ');
      return (
        r.action.toLowerCase().includes(needle) ||
        who.includes(needle) ||
        entity.toLowerCase().includes(needle)
      );
    });
  }, [rows, q, actionFilter]);

  return (
    <>
      <PageHeader
        icon={<ScrollText size={22} />}
        title="Audit log"
        subtitle="Recent actions across this tenant"
      />
      {error ? <Alert>{error}</Alert> : null}
      <div className="panel">
        <div className="filter-bar">
          <Field label="Search" htmlFor="audit-q" className="filter-grow">
            <input
              id="audit-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Action, user, entity…"
            />
          </Field>
          <Field label="Action" htmlFor="audit-action">
            <select
              id="audit-action"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">All actions</option>
              {actionOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Field>
          <div className="filter-bar-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setQ('');
                setActionFilter('');
              }}
            >
              Reset
            </Button>
          </div>
        </div>
        <p className="filter-meta">
          Showing {filtered.length} of {rows.length} entries
        </p>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <DataTable
            columns={[
              { key: 'when', label: 'When' },
              { key: 'who', label: 'Who' },
              { key: 'action', label: 'Action' },
              { key: 'entity', label: 'Entity' },
            ]}
            rows={filtered.map((r) => ({
              id: r.id,
              cells: {
                when: new Date(r.createdAt).toLocaleString('en-IN'),
                who: r.user
                  ? `${r.user.firstName} ${r.user.lastName}`
                  : '—',
                action: r.action,
                entity: [r.entityType, r.entityId?.slice(0, 8)]
                  .filter(Boolean)
                  .join(' · '),
              },
            }))}
            emptyText="No audit entries match these filters."
          />
        )}
      </div>
    </>
  );
}
