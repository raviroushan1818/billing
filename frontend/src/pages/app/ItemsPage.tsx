import { useEffect, useMemo, useState } from 'react';
import { itemsApi } from '../../api';
import type { Item } from '../../types';
import { formatInr, toNum } from '../../utils/format';
import { CsvImportControls } from '../../components/CsvImportControls';
import { useDialog } from '../../components/Dialog';
import {
  Alert,
  Button,
  DataTable,
  Field,
  PageHeader,
  useFormSubmit,
} from '../../components/ui';
import { Package } from 'lucide-react';

export function ItemsPage() {
  const dialog = useDialog();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Item | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hsnSac, setHsnSac] = useState('');
  const [unit, setUnit] = useState('NOS');
  const [rate, setRate] = useState('0');
  const [gstRate, setGstRate] = useState('18');
  const [barcode, setBarcode] = useState('');
  const [trackStock, setTrackStock] = useState(false);
  const [stockQty, setStockQty] = useState('0');
  const [filter, setFilter] = useState('');
  const [stockFilter, setStockFilter] = useState<
    '' | 'tracked' | 'untracked' | 'zero' | 'instock'
  >('');
  const [gstFilter, setGstFilter] = useState('');

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return items.filter((i) => {
      const tracked = Boolean(i.trackStock);
      const qty = toNum(i.stockQty);
      if (stockFilter === 'tracked' && !tracked) return false;
      if (stockFilter === 'untracked' && tracked) return false;
      if (stockFilter === 'zero' && (!tracked || qty > 0)) return false;
      if (stockFilter === 'instock' && (!tracked || qty <= 0)) return false;
      if (gstFilter !== '' && toNum(i.gstRate) !== Number(gstFilter)) {
        return false;
      }
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        (i.hsnSac ?? '').toLowerCase().includes(q) ||
        (i.barcode ?? '').toLowerCase().includes(q) ||
        (i.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [items, filter, stockFilter, gstFilter]);

  const load = () => {
    setLoading(true);
    itemsApi
      .list()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setHsnSac('');
    setUnit('NOS');
    setRate('0');
    setGstRate('18');
    setBarcode('');
    setTrackStock(false);
    setStockQty('0');
  };

  const startEdit = (item: Item) => {
    setEditing(item);
    setName(item.name);
    setDescription(item.description ?? '');
    setHsnSac(item.hsnSac ?? '');
    setUnit(item.unit ?? 'NOS');
    setRate(String(item.rate));
    setGstRate(String(item.gstRate));
    setBarcode(item.barcode ?? '');
    setTrackStock(Boolean(item.trackStock));
    setStockQty(String(item.stockQty ?? 0));
  };

  const { busy, error, success, handle } = useFormSubmit(async () => {
    const payload = {
      name: name.trim(),
      description: description || undefined,
      hsnSac: hsnSac || undefined,
      unit,
      rate: toNum(rate),
      gstRate: toNum(gstRate),
      barcode: barcode || undefined,
      trackStock,
      stockQty: trackStock && !editing ? toNum(stockQty) : undefined,
    };
    if (editing) {
      await itemsApi.update(editing.id, {
        ...payload,
        stockQty: undefined,
      });
    } else {
      await itemsApi.create(payload);
    }
    resetForm();
    load();
  });

  const adjust = async (item: Item) => {
    const raw = await dialog.prompt({
      title: 'Adjust stock',
      message: `Current stock for ${item.name}: ${toNum(item.stockQty)}. Enter a delta (e.g. 10 or -2).`,
      label: 'Qty delta',
      placeholder: '10',
      confirmLabel: 'Apply',
      required: true,
    });
    if (raw == null || !raw.trim()) return;
    const qtyDelta = Number(raw);
    if (!Number.isFinite(qtyDelta) || qtyDelta === 0) {
      await dialog.alert({
        title: 'Invalid quantity',
        message: 'Enter a non-zero number for the stock delta.',
        variant: 'danger',
      });
      return;
    }
    try {
      await itemsApi.adjustStock(item.id, { qtyDelta });
      load();
    } catch (e) {
      await dialog.alert({
        title: 'Adjust failed',
        message: e instanceof Error ? e.message : 'Could not adjust stock',
        variant: 'danger',
      });
    }
  };

  return (
    <>
      <PageHeader
        icon={<Package size={22} />}
        title="Items"
        subtitle="Item master for billing"
        actions={
          <CsvImportControls
            templatePath="/items/import/template"
            importPath="/items/import"
            templateName="items-template.csv"
            onImported={() => load()}
          />
        }
      />

      <div className="panel">
        <h2 className="panel-title">{editing ? 'Edit item' : 'Add item'}</h2>
        {error ? <Alert>{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}
        <form
          className="form-stack"
          onSubmit={(e) => {
            void handle(e);
          }}
        >
          <div className="grid-3">
            <Field label="Name" htmlFor="i-name">
              <input
                id="i-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field label="HSN/SAC" htmlFor="i-hsn">
              <input
                id="i-hsn"
                value={hsnSac}
                onChange={(e) => setHsnSac(e.target.value)}
              />
            </Field>
            <Field label="Unit" htmlFor="i-unit">
              <input
                id="i-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </Field>
            <Field label="Rate (₹)" htmlFor="i-rate">
              <input
                id="i-rate"
                type="number"
                min={0}
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                required
              />
            </Field>
            <Field label="GST %" htmlFor="i-gst">
              <input
                id="i-gst"
                type="number"
                min={0}
                step="0.01"
                value={gstRate}
                onChange={(e) => setGstRate(e.target.value)}
              />
            </Field>
            <Field label="Barcode" htmlFor="i-barcode">
              <input
                id="i-barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
              />
            </Field>
            <Field label="Description" htmlFor="i-desc">
              <input
                id="i-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={trackStock}
                onChange={(e) => setTrackStock(e.target.checked)}
              />
              Track stock
            </label>
            {trackStock && !editing ? (
              <Field label="Opening stock" htmlFor="i-stock">
                <input
                  id="i-stock"
                  type="number"
                  step="0.001"
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                />
              </Field>
            ) : null}
          </div>
          <div className="btn-group">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Update' : 'Create'}
            </Button>
            {editing ? (
              <Button type="button" variant="secondary" onClick={resetForm}>
                Cancel edit
              </Button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="panel">
        <h2 className="panel-title">Item catalog</h2>
        <div className="filter-bar">
          <Field label="Search" htmlFor="item-filter" className="filter-grow">
            <input
              id="item-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Name, HSN, barcode…"
            />
          </Field>
          <Field label="Stock" htmlFor="item-stock-f">
            <select
              id="item-stock-f"
              value={stockFilter}
              onChange={(e) =>
                setStockFilter(
                  e.target.value as
                    | ''
                    | 'tracked'
                    | 'untracked'
                    | 'zero'
                    | 'instock',
                )
              }
            >
              <option value="">All items</option>
              <option value="tracked">Stock tracked</option>
              <option value="untracked">Not tracked</option>
              <option value="instock">In stock</option>
              <option value="zero">Zero stock</option>
            </select>
          </Field>
          <Field label="GST %" htmlFor="item-gst-f">
            <select
              id="item-gst-f"
              value={gstFilter}
              onChange={(e) => setGstFilter(e.target.value)}
            >
              <option value="">All rates</option>
              <option value="0">0%</option>
              <option value="5">5%</option>
              <option value="12">12%</option>
              <option value="18">18%</option>
              <option value="28">28%</option>
            </select>
          </Field>
          <div className="filter-bar-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setFilter('');
                setStockFilter('');
                setGstFilter('');
              }}
            >
              Reset
            </Button>
          </div>
        </div>
        <p className="filter-meta">
          Showing {filtered.length} of {items.length} items
        </p>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <DataTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'hsn', label: 'HSN' },
              { key: 'rate', label: 'Rate', align: 'right' },
              { key: 'gst', label: 'GST%', align: 'right' },
              { key: 'stock', label: 'Stock' },
              { key: 'actions', label: '' },
            ]}
            rows={filtered.map((i) => ({
              id: i.id,
              cells: {
                name: i.name,
                hsn: i.hsnSac ?? '—',
                rate: formatInr(toNum(i.rate)),
                gst: `${toNum(i.gstRate)}%`,
                stock: i.trackStock ? String(toNum(i.stockQty)) : '—',
                actions: (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button variant="secondary" onClick={() => startEdit(i)}>
                      Edit
                    </Button>
                    {i.trackStock ? (
                      <Button
                        variant="secondary"
                        onClick={() => void adjust(i)}
                      >
                        Adjust
                      </Button>
                    ) : null}
                  </div>
                ),
              },
            }))}
            emptyText="No items match your search."
          />
        )}
      </div>
    </>
  );
}
