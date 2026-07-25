import { useEffect, useMemo, useState } from 'react';
import { ewayApi, invoicesApi } from '../../api';
import type { EwayBill, Invoice } from '../../types';
import { formatInr, toNum } from '../../utils/format';
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
import { Truck } from 'lucide-react';

export function EwayPage() {
  const dialog = useDialog();
  const [rows, setRows] = useState<EwayBill[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceId, setInvoiceId] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [transporterName, setTransporterName] = useState('');
  const [fromPlace, setFromPlace] = useState('');
  const [toPlace, setToPlace] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    '' | 'DRAFT' | 'GENERATED' | 'CANCELLED' | 'FAILED'
  >('');
  const [loading, setLoading] = useState(true);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (!needle) return true;
      return (
        (r.ewbNo ?? '').toLowerCase().includes(needle) ||
        (r.invoice?.billNo ?? '').toLowerCase().includes(needle) ||
        (r.invoice?.partyName ?? '').toLowerCase().includes(needle) ||
        (r.vehicleNo ?? '').toLowerCase().includes(needle) ||
        (r.transporter ?? '').toLowerCase().includes(needle)
      );
    });
  }, [rows, q, statusFilter]);

  const load = () => {
    setLoading(true);
    void Promise.all([
      ewayApi.list().then(setRows).catch(() => setRows([])),
      invoicesApi
        .list({ status: 'FINALIZED' })
        .then(setInvoices)
        .catch(() => setInvoices([])),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const { busy, error, success, handle } = useFormSubmit(async () => {
    await ewayApi.create({
      invoiceId,
      vehicleNo: vehicleNo || undefined,
      transporterName: transporterName || undefined,
      fromPlace: fromPlace || undefined,
      toPlace: toPlace || undefined,
      distanceKm: distanceKm ? Number(distanceKm) : undefined,
    });
    setInvoiceId('');
    setVehicleNo('');
    setTransporterName('');
    setFromPlace('');
    setToPlace('');
    setDistanceKm('');
    setShowForm(false);
    load();
  });

  return (
    <>
      <PageHeader
        icon={<Truck size={22} />}
        title="E-way bills"
        subtitle="Generate e-way against finalized invoices (stub by default; set EWAY_PROVIDER=http for live GSP)"
        actions={
          <Button onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Hide' : 'Generate'}
          </Button>
        }
      />

      {showForm ? (
        <div className="panel">
          {error ? <Alert>{error}</Alert> : null}
          {success ? <Alert variant="success">{success}</Alert> : null}
          <form className="form-stack" onSubmit={(e) => void handle(e)}>
            <Field label="Invoice" htmlFor="ew-inv">
              <select
                id="ew-inv"
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
                required
              >
                <option value="">Select bill</option>
                {invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.billNo} · {inv.partyName} ·{' '}
                    {formatInr(toNum(inv.grandTotal))}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid-2">
              <Field label="Vehicle no." htmlFor="ew-v">
                <input
                  id="ew-v"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                />
              </Field>
              <Field label="Transporter" htmlFor="ew-t">
                <input
                  id="ew-t"
                  value={transporterName}
                  onChange={(e) => setTransporterName(e.target.value)}
                />
              </Field>
              <Field label="From" htmlFor="ew-f">
                <input
                  id="ew-f"
                  value={fromPlace}
                  onChange={(e) => setFromPlace(e.target.value)}
                />
              </Field>
              <Field label="To" htmlFor="ew-to">
                <input
                  id="ew-to"
                  value={toPlace}
                  onChange={(e) => setToPlace(e.target.value)}
                />
              </Field>
              <Field label="Distance (km)" htmlFor="ew-d">
                <input
                  id="ew-d"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                />
              </Field>
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? 'Generating…' : 'Generate e-way'}
            </Button>
          </form>
        </div>
      ) : null}

      <div className="panel">
        <div className="filter-bar">
          <Field label="Search" htmlFor="ew-q" className="filter-grow">
            <input
              id="ew-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="EWB no, invoice, party, vehicle…"
            />
          </Field>
          <Field label="Status" htmlFor="ew-st">
            <select
              id="ew-st"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as
                    | ''
                    | 'DRAFT'
                    | 'GENERATED'
                    | 'CANCELLED'
                    | 'FAILED',
                )
              }
            >
              <option value="">All</option>
              <option value="GENERATED">Generated</option>
              <option value="DRAFT">Draft</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="FAILED">Failed</option>
            </select>
          </Field>
          <div className="filter-bar-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setQ('');
                setStatusFilter('');
              }}
            >
              Reset
            </Button>
          </div>
        </div>
        <p className="filter-meta">
          Showing {filtered.length} of {rows.length} e-way bills
        </p>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <DataTable
            columns={[
              { key: 'ewb', label: 'EWB No' },
              { key: 'inv', label: 'Invoice' },
              { key: 'party', label: 'Party' },
              { key: 'vehicle', label: 'Vehicle' },
              { key: 'status', label: 'Status' },
              { key: 'valid', label: 'Valid until' },
              { key: 'actions', label: '' },
            ]}
            rows={filtered.map((r) => ({
              id: r.id,
              cells: {
                ewb: r.ewbNo ?? '—',
                inv: r.invoice?.billNo ?? '—',
                party: r.invoice?.partyName ?? '—',
                vehicle: r.vehicleNo ?? '—',
                status: <StatusBadge status={r.status} />,
                valid: r.validUntil?.slice(0, 10) ?? '—',
                actions:
                  r.status === 'GENERATED' ? (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        void (async () => {
                          const ok = await dialog.confirm({
                            title: 'Cancel e-way bill',
                            message: `Cancel e-way bill ${r.ewbNo ?? r.id}?`,
                            confirmLabel: 'Cancel e-way',
                            danger: true,
                          });
                          if (!ok) return;
                          await ewayApi.cancel(r.id);
                          load();
                        })()
                      }
                    >
                      Cancel
                    </Button>
                  ) : null,
              },
            }))}
            emptyText="No e-way bills match these filters."
          />
        )}
      </div>
    </>
  );
}
