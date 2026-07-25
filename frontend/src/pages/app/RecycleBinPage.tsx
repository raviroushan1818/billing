import { useEffect, useMemo, useState } from 'react';
import { invoicesApi } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import {
  actorDisplayName,
  canEmptyRecycleBin,
  roleLabel,
} from '../../auth/roles';
import type { Invoice } from '../../types';
import { formatInr, toNum } from '../../utils/format';
import { useDialog } from '../../components/Dialog';
import {
  Alert,
  Button,
  DataTable,
  Field,
  PageHeader,
  StatusBadge,
} from '../../components/ui';
import { Trash2 } from 'lucide-react';

export function RecycleBinPage() {
  const { user } = useAuth();
  const dialog = useDialog();
  const [bills, setBills] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const canEmpty = user ? canEmptyRecycleBin(user.role) : false;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return bills;
    return bills.filter(
      (b) =>
        b.billNo.toLowerCase().includes(needle) ||
        b.partyName.toLowerCase().includes(needle) ||
        (b.partyGstin ?? '').toLowerCase().includes(needle) ||
        (b.partyPhone ?? '').toLowerCase().includes(needle),
    );
  }, [bills, q]);

  const load = () => {
    setLoading(true);
    setError(null);
    invoicesApi
      .recycleBin()
      .then(setBills)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load recycle bin');
        setBills([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const restore = async (b: Invoice) => {
    try {
      setError(null);
      setSuccess(null);
      await invoicesApi.restore(b.id);
      setSuccess(`Restored ${b.billNo}`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed');
    }
  };

  const permanentDelete = async (b: Invoice) => {
    const ok = await dialog.confirm({
      title: 'Delete forever',
      message: `Permanently delete ${b.billNo}? This cannot be undone.`,
      confirmLabel: 'Delete forever',
      danger: true,
    });
    if (!ok) return;
    try {
      setError(null);
      setSuccess(null);
      await invoicesApi.permanentDelete(b.id);
      setSuccess(`Permanently deleted ${b.billNo}`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Permanent delete failed');
    }
  };

  const emptyBin = async () => {
    if (!bills.length) return;
    const ok = await dialog.confirm({
      title: 'Empty recycle bin',
      message: `Permanently delete ${bills.length} bill(s) from the recycle bin? This cannot be undone.`,
      confirmLabel: 'Empty bin',
      danger: true,
    });
    if (!ok) return;
    try {
      setError(null);
      setSuccess(null);
      const result = await invoicesApi.emptyRecycleBin();
      setSuccess(`Emptied recycle bin (${result.count} deleted)`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Empty bin failed');
    }
  };

  return (
    <>
      <PageHeader
        icon={<Trash2 size={22} />}
        title="Recycle bin"
        subtitle="Soft-deleted invoices. Staff can restore; only the Owner can empty the bin."
        actions={
          canEmpty ? (
            <Button
              variant="danger"
              disabled={!bills.length || loading}
              onClick={() => void emptyBin()}
            >
              Empty recycle bin
            </Button>
          ) : null
        }
      />

      {error ? <Alert>{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      <div className="panel">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : bills.length === 0 ? (
          <p className="muted">Recycle bin is empty.</p>
        ) : (
          <>
            <div className="filter-bar">
              <Field label="Search" htmlFor="bin-q" className="filter-grow">
                <input
                  id="bin-q"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Bill no, party, GSTIN, phone…"
                />
              </Field>
              <div className="filter-bar-actions">
                <Button variant="secondary" onClick={() => setQ('')}>
                  Reset
                </Button>
              </div>
            </div>
            <p className="filter-meta">
              Showing {filtered.length} of {bills.length} deleted bills
            </p>
            <DataTable
              columns={[
                { key: 'billNo', label: 'Bill No' },
                { key: 'date', label: 'Bill date' },
                { key: 'deleted', label: 'Deleted on' },
                { key: 'party', label: 'Party' },
                { key: 'raisedBy', label: 'Raised by' },
                { key: 'total', label: 'Total', align: 'right' },
                { key: 'status', label: 'Status' },
                { key: 'actions', label: '' },
              ]}
              rows={filtered.map((b) => ({
                id: b.id,
                cells: {
                  billNo: b.billNo,
                  date: b.invoiceDate.slice(0, 10),
                  deleted: b.deletedAt
                    ? new Date(b.deletedAt).toISOString().slice(0, 10)
                    : '—',
                  party: b.partyName,
                  raisedBy: (
                    <div className="actor-cell">
                      <span>{actorDisplayName(b.createdBy)}</span>
                      {b.createdBy?.role ? (
                        <span
                          className={`role-badge role-${b.createdBy.role.toLowerCase()}`}
                        >
                          {roleLabel(b.createdBy.role)}
                        </span>
                      ) : null}
                    </div>
                  ),
                  total: formatInr(toNum(b.grandTotal)),
                  status: <StatusBadge status={b.status} />,
                  actions: (
                    <div className="inline-actions">
                      <Button
                        variant="secondary"
                        onClick={() => void restore(b)}
                      >
                        Restore
                      </Button>
                      {canEmpty ? (
                        <Button
                          variant="danger"
                          onClick={() => void permanentDelete(b)}
                        >
                          Delete forever
                        </Button>
                      ) : null}
                    </div>
                  ),
                },
              }))}
              emptyText="No deleted bills match this search."
            />
          </>
        )}
      </div>
    </>
  );
}
