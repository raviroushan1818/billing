import { useEffect, useMemo, useState } from 'react';
import { inventoryApi } from '../../api';
import type { Godown, GodownStockRow } from '../../types';
import { toNum } from '../../utils/format';
import {
  Alert,
  Button,
  DataTable,
  Field,
  PageHeader,
  useFormSubmit,
} from '../../components/ui';
import { ArrowLeftRight, Plus, Warehouse } from 'lucide-react';

export function InventoryPage() {
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [stock, setStock] = useState<GodownStockRow[]>([]);
  const [transferStock, setTransferStock] = useState<GodownStockRow[]>([]);
  const [filterGodown, setFilterGodown] = useState('');
  const [stockQ, setStockQ] = useState('');
  const [stockLevel, setStockLevel] = useState<'' | 'positive' | 'zero'>('');
  const [godownQ, setGodownQ] = useState('');
  const [godownActive, setGodownActive] = useState<'' | 'active' | 'inactive'>(
    '',
  );
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [fromGodownId, setFromGodownId] = useState('');
  const [toGodownId, setToGodownId] = useState('');
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('1');
  const [xferError, setXferError] = useState<string | null>(null);
  const [xferSuccess, setXferSuccess] = useState<string | null>(null);
  const [xferBusy, setXferBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const filteredGodowns = useMemo(() => {
    const needle = godownQ.trim().toLowerCase();
    return godowns.filter((g) => {
      if (godownActive === 'active' && !g.isActive) return false;
      if (godownActive === 'inactive' && g.isActive) return false;
      if (!needle) return true;
      return (
        g.name.toLowerCase().includes(needle) ||
        (g.code ?? '').toLowerCase().includes(needle) ||
        (g.address ?? '').toLowerCase().includes(needle)
      );
    });
  }, [godowns, godownQ, godownActive]);

  const filteredStock = useMemo(() => {
    const needle = stockQ.trim().toLowerCase();
    return stock.filter((s) => {
      const qtyN = toNum(s.qty);
      if (stockLevel === 'positive' && qtyN <= 0) return false;
      if (stockLevel === 'zero' && qtyN !== 0) return false;
      if (!needle) return true;
      return (
        s.item.name.toLowerCase().includes(needle) ||
        (s.item.barcode ?? '').toLowerCase().includes(needle) ||
        s.godown.name.toLowerCase().includes(needle) ||
        (s.godown.code ?? '').toLowerCase().includes(needle)
      );
    });
  }, [stock, stockQ, stockLevel]);

  const transferItems = useMemo(() => {
    const source = fromGodownId
      ? transferStock.filter((s) => s.godown.id === fromGodownId)
      : transferStock;
    return Array.from(new Map(source.map((s) => [s.item.id, s.item])).values());
  }, [transferStock, fromGodownId]);

  const load = () => {
    setLoading(true);
    void Promise.all([
      inventoryApi.listGodowns().then(setGodowns).catch(() => setGodowns([])),
      inventoryApi
        .stock(filterGodown || undefined)
        .then(setStock)
        .catch(() => setStock([])),
      inventoryApi
        .stock()
        .then(setTransferStock)
        .catch(() => setTransferStock([])),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [filterGodown]);

  const { busy, error, success, handle } = useFormSubmit(
    async () => {
      await inventoryApi.createGodown({
        name: name.trim(),
        code: code || undefined,
        address: address || undefined,
        isDefault,
      });
      setName('');
      setCode('');
      setAddress('');
      setIsDefault(false);
      load();
    },
    'Godown created',
  );

  const transfer = async () => {
    setXferError(null);
    setXferSuccess(null);
    if (!fromGodownId || !toGodownId) {
      setXferError('Select both From and To godowns');
      return;
    }
    if (fromGodownId === toGodownId) {
      setXferError('From and To godowns must be different');
      return;
    }
    if (!itemId) {
      setXferError('Select an item to transfer');
      return;
    }
    const qtyN = toNum(qty);
    if (!(qtyN > 0)) {
      setXferError('Enter a quantity greater than zero');
      return;
    }
    setXferBusy(true);
    try {
      await inventoryApi.transfer({
        itemId,
        fromGodownId,
        toGodownId,
        qty: qtyN,
      });
      setQty('1');
      setXferSuccess('Stock transferred');
      load();
    } catch (e) {
      setXferError(e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setXferBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        icon={<Warehouse size={22} />}
        title="Godowns & stock"
        subtitle="Multi-location inventory with transfers"
      />

      <div className="panel">
        <h2 className="panel-title">
          <Plus size={16} /> Add godown
        </h2>
        {error ? <Alert>{error}</Alert> : null}
        {success ? <Alert variant="success">{success}</Alert> : null}
        <form className="form-stack" onSubmit={(e) => void handle(e)}>
          <div className="grid-2">
            <Field label="Name" htmlFor="g-n">
              <input
                id="g-n"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field label="Code" htmlFor="g-c">
              <input
                id="g-c"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Address" htmlFor="g-a">
            <input
              id="g-a"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </Field>
          <label className="check-row">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
            />
            Default godown
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Create godown'}
          </Button>
        </form>
      </div>

      <div className="panel">
        <h2 className="panel-title">Godowns</h2>
        <div className="filter-bar">
          <Field label="Search" htmlFor="gd-q" className="filter-grow">
            <input
              id="gd-q"
              value={godownQ}
              onChange={(e) => setGodownQ(e.target.value)}
              placeholder="Name, code, address…"
            />
          </Field>
          <Field label="Status" htmlFor="gd-st">
            <select
              id="gd-st"
              value={godownActive}
              onChange={(e) =>
                setGodownActive(e.target.value as '' | 'active' | 'inactive')
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
                setGodownQ('');
                setGodownActive('');
              }}
            >
              Reset
            </Button>
          </div>
        </div>
        <p className="filter-meta">
          Showing {filteredGodowns.length} of {godowns.length} godowns
        </p>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <DataTable
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'code', label: 'Code' },
              { key: 'def', label: 'Default' },
              { key: 'actions', label: '' },
            ]}
            rows={filteredGodowns.map((g) => ({
              id: g.id,
              cells: {
                name: g.name,
                code: g.code ?? '—',
                def: g.isDefault ? 'Yes' : '—',
                actions: !g.isDefault ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void inventoryApi
                        .updateGodown(g.id, { isDefault: true })
                        .then(load)
                    }
                  >
                    Make default
                  </Button>
                ) : null,
              },
            }))}
            emptyText="No godowns match these filters."
          />
        )}
      </div>

      <div className="panel">
        <h2 className="panel-title">
          <ArrowLeftRight size={16} /> Transfer stock
        </h2>
        {xferError ? <Alert>{xferError}</Alert> : null}
        {xferSuccess ? <Alert variant="success">{xferSuccess}</Alert> : null}
        <div className="grid-2">
          <Field label="From" htmlFor="t-f">
            <select
              id="t-f"
              value={fromGodownId}
              onChange={(e) => {
                setFromGodownId(e.target.value);
                setItemId('');
              }}
            >
              <option value="">—</option>
              {godowns.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="To" htmlFor="t-t">
            <select
              id="t-t"
              value={toGodownId}
              onChange={(e) => setToGodownId(e.target.value)}
            >
              <option value="">—</option>
              {godowns.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Item" htmlFor="t-i">
            <select
              id="t-i"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
            >
              <option value="">—</option>
              {transferItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Qty" htmlFor="t-q">
            <input
              id="t-q"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="decimal"
            />
          </Field>
        </div>
        <div className="row-actions">
          <Button disabled={xferBusy} onClick={() => void transfer()}>
            {xferBusy ? 'Transferring…' : 'Transfer'}
          </Button>
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">Stock by godown</h2>
        <div className="filter-bar">
          <Field label="Search" htmlFor="stk-q" className="filter-grow">
            <input
              id="stk-q"
              value={stockQ}
              onChange={(e) => setStockQ(e.target.value)}
              placeholder="Item, barcode, godown…"
            />
          </Field>
          <Field label="Godown" htmlFor="stk-g">
            <select
              id="stk-g"
              value={filterGodown}
              onChange={(e) => setFilterGodown(e.target.value)}
            >
              <option value="">All godowns</option>
              {godowns.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Qty" htmlFor="stk-lvl">
            <select
              id="stk-lvl"
              value={stockLevel}
              onChange={(e) =>
                setStockLevel(e.target.value as '' | 'positive' | 'zero')
              }
            >
              <option value="">All</option>
              <option value="positive">In stock</option>
              <option value="zero">Zero</option>
            </select>
          </Field>
          <div className="filter-bar-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setStockQ('');
                setFilterGodown('');
                setStockLevel('');
              }}
            >
              Reset
            </Button>
          </div>
        </div>
        <p className="filter-meta">
          Showing {filteredStock.length} of {stock.length} rows
        </p>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <DataTable
            columns={[
              { key: 'item', label: 'Item' },
              { key: 'godown', label: 'Godown' },
              { key: 'qty', label: 'Qty', align: 'right' },
              { key: 'unit', label: 'Unit' },
            ]}
            rows={filteredStock.map((s) => ({
              id: s.id,
              cells: {
                item: s.item.name,
                godown: s.godown.name,
                qty: String(toNum(s.qty)),
                unit: s.item.unit,
              },
            }))}
            emptyText="No stock rows match these filters."
          />
        )}
      </div>
    </>
  );
}
