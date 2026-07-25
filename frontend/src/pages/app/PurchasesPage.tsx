import { useEffect, useMemo, useState } from 'react';
import { inventoryApi, itemsApi, purchasesApi } from '../../api';
import type { Godown, Item, PurchaseBill } from '../../types';
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
import { ShoppingCart } from 'lucide-react';

type Line = {
  itemId: string;
  description: string;
  hsnSac: string;
  qty: string;
  rate: string;
  gstRate: string;
};

const emptyLine = (): Line => ({
  itemId: '',
  description: '',
  hsnSac: '',
  qty: '1',
  rate: '0',
  gstRate: '18',
});

export function PurchasesPage() {
  const dialog = useDialog();
  const [rows, setRows] = useState<PurchaseBill[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [vendorGstin, setVendorGstin] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [godownId, setGodownId] = useState('');
  const [interstate, setInterstate] = useState(false);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    '' | 'FINALIZED' | 'VOID'
  >('');
  const [itcFilter, setItcFilter] = useState<'' | 'yes' | 'no'>('');
  const [loading, setLoading] = useState(true);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (itcFilter === 'yes' && !r.itcEligible) return false;
      if (itcFilter === 'no' && r.itcEligible) return false;
      if (!needle) return true;
      return (
        r.billNo.toLowerCase().includes(needle) ||
        r.vendorName.toLowerCase().includes(needle) ||
        (r.vendorGstin ?? '').toLowerCase().includes(needle) ||
        (r.godown?.name ?? '').toLowerCase().includes(needle)
      );
    });
  }, [rows, q, statusFilter, itcFilter]);

  const load = () => {
    setLoading(true);
    void Promise.all([
      purchasesApi.list().then(setRows).catch(() => setRows([])),
      itemsApi.list().then(setItems).catch(() => setItems([])),
      inventoryApi.listGodowns().then(setGodowns).catch(() => setGodowns([])),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const pickItem = (idx: number, itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    setLines((prev) =>
      prev.map((l, i) =>
        i !== idx
          ? l
          : {
              ...l,
              itemId,
              description: item?.name ?? l.description,
              hsnSac: item?.hsnSac ?? '',
              rate: item ? String(item.rate) : l.rate,
              gstRate: item ? String(item.gstRate) : l.gstRate,
            },
      ),
    );
  };

  const { busy, error, success, handle } = useFormSubmit(async () => {
    const payloadLines = lines
      .filter((l) => l.description.trim())
      .map((l) => ({
        itemId: l.itemId || undefined,
        description: l.description.trim(),
        hsnSac: l.hsnSac || undefined,
        qty: toNum(l.qty),
        rate: toNum(l.rate),
        gstRate: toNum(l.gstRate),
      }));
    if (!payloadLines.length) throw new Error('Add at least one line');
    await purchasesApi.create({
      vendorName: vendorName.trim(),
      vendorGstin: vendorGstin || undefined,
      vendorPhone: vendorPhone || undefined,
      godownId: godownId || undefined,
      interstate,
      notes: notes || undefined,
      lines: payloadLines,
    });
    setVendorName('');
    setVendorGstin('');
    setVendorPhone('');
    setNotes('');
    setGodownId('');
    setInterstate(false);
    setLines([emptyLine()]);
    setShowForm(false);
    load();
  });

  return (
    <>
      <PageHeader
        icon={<ShoppingCart size={22} />}
        title="Purchase bills"
        subtitle="Vendor purchases that add stock to a godown"
        actions={
          <Button onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Hide' : 'New purchase'}
          </Button>
        }
      />

      {showForm ? (
        <div className="panel">
          {error ? <Alert>{error}</Alert> : null}
          {success ? <Alert variant="success">{success}</Alert> : null}
          <form className="form-stack" onSubmit={(e) => void handle(e)}>
            <div className="grid-2">
              <Field label="Vendor name" htmlFor="p-v">
                <input
                  id="p-v"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  required
                />
              </Field>
              <Field label="Godown" htmlFor="p-g">
                <select
                  id="p-g"
                  value={godownId}
                  onChange={(e) => setGodownId(e.target.value)}
                >
                  <option value="">Default</option>
                  {godowns.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="GSTIN" htmlFor="p-gst">
                <input
                  id="p-gst"
                  value={vendorGstin}
                  onChange={(e) => setVendorGstin(e.target.value)}
                />
              </Field>
              <Field label="Phone" htmlFor="p-ph">
                <input
                  id="p-ph"
                  value={vendorPhone}
                  onChange={(e) => setVendorPhone(e.target.value)}
                />
              </Field>
            </div>
            <label className="check-row">
              <input
                type="checkbox"
                checked={interstate}
                onChange={(e) => setInterstate(e.target.checked)}
              />
              Interstate (IGST)
            </label>
            <Field label="Notes" htmlFor="p-n">
              <input
                id="p-n"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>

            <h4>Lines</h4>
            {lines.map((l, idx) => (
              <div key={idx} className="grid-2" style={{ marginBottom: 8 }}>
                <Field label="Catalog item" htmlFor={`pi-${idx}`}>
                  <select
                    id={`pi-${idx}`}
                    value={l.itemId}
                    onChange={(e) => pickItem(idx, e.target.value)}
                  >
                    <option value="">Manual</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Description" htmlFor={`pd-${idx}`}>
                  <input
                    id={`pd-${idx}`}
                    value={l.description}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((x, i) =>
                          i === idx
                            ? { ...x, description: e.target.value }
                            : x,
                        ),
                      )
                    }
                    required
                  />
                </Field>
                <Field label="Qty" htmlFor={`pq-${idx}`}>
                  <input
                    id={`pq-${idx}`}
                    value={l.qty}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, qty: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Rate" htmlFor={`pr-${idx}`}>
                  <input
                    id={`pr-${idx}`}
                    value={l.rate}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, rate: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="GST %" htmlFor={`pg-${idx}`}>
                  <input
                    id={`pg-${idx}`}
                    value={l.gstRate}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, gstRate: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
            ))}
            <div className="row-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setLines((p) => [...p, emptyLine()])}
              >
                Add line
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save purchase'}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="panel">
        <div className="filter-bar">
          <Field label="Search" htmlFor="pur-q" className="filter-grow">
            <input
              id="pur-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Bill #, vendor, GSTIN, godown…"
            />
          </Field>
          <Field label="Status" htmlFor="pur-st">
            <select
              id="pur-st"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as '' | 'FINALIZED' | 'VOID')
              }
            >
              <option value="">All</option>
              <option value="FINALIZED">Finalized</option>
              <option value="VOID">Void</option>
            </select>
          </Field>
          <Field label="ITC" htmlFor="pur-itc">
            <select
              id="pur-itc"
              value={itcFilter}
              onChange={(e) =>
                setItcFilter(e.target.value as '' | 'yes' | 'no')
              }
            >
              <option value="">All</option>
              <option value="yes">ITC eligible</option>
              <option value="no">Not eligible</option>
            </select>
          </Field>
          <div className="filter-bar-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setQ('');
                setStatusFilter('');
                setItcFilter('');
              }}
            >
              Reset
            </Button>
          </div>
        </div>
        <p className="filter-meta">
          Showing {filtered.length} of {rows.length} purchases
        </p>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <DataTable
            columns={[
              { key: 'billNo', label: 'Bill #' },
              { key: 'date', label: 'Date' },
              { key: 'vendor', label: 'Vendor' },
              { key: 'godown', label: 'Godown' },
              { key: 'total', label: 'Total', align: 'right' },
              { key: 'itc', label: 'ITC' },
              { key: 'status', label: 'Status' },
              { key: 'actions', label: '' },
            ]}
            rows={filtered.map((r) => ({
              id: r.id,
              cells: {
                billNo: r.billNo,
                date: r.billDate?.slice(0, 10) ?? '',
                vendor: r.vendorName,
                godown: r.godown?.name ?? '—',
                total: formatInr(toNum(r.grandTotal)),
                itc: r.itcEligible ? 'Yes' : 'No',
                status: <StatusBadge status={r.status} />,
                actions:
                  r.status !== 'VOID' ? (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        void (async () => {
                          const ok = await dialog.confirm({
                            title: 'Void purchase',
                            message: `Void purchase bill ${r.billNo}? Stock will be reversed if applicable.`,
                            confirmLabel: 'Void',
                            danger: true,
                          });
                          if (!ok) return;
                          await purchasesApi.void(r.id);
                          load();
                        })()
                      }
                    >
                      Void
                    </Button>
                  ) : null,
              },
            }))}
            emptyText="No purchases match these filters."
          />
        )}
      </div>
    </>
  );
}
