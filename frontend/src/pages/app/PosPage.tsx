import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoicesApi, inventoryApi, itemsApi } from '../../api';
import type { Godown, Item, PaymentMode } from '../../types';
import { formatInr, round2, toNum } from '../../utils/format';
import {
  Alert,
  Button,
  Field,
  PageHeader,
} from '../../components/ui';
import { MonitorSmartphone } from 'lucide-react';

type CartLine = {
  key: string;
  itemId?: string;
  description: string;
  hsnSac?: string;
  qty: number;
  rate: number;
  gstRate: number;
};

export function PosPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [godownId, setGodownId] = useState('');
  const [q, setQ] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [partyName, setPartyName] = useState('Walk-in customer');
  const [partyPhone, setPartyPhone] = useState('');
  const [payMode, setPayMode] = useState<PaymentMode>('CASH');
  const [upiRef, setUpiRef] = useState('');
  const [cardLast4, setCardLast4] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastBill, setLastBill] = useState<string | null>(null);

  useEffect(() => {
    void itemsApi.list().then(setItems).catch(() => setItems([]));
    void inventoryApi
      .listGodowns()
      .then((rows) => {
        setGodowns(rows);
        const def = rows.find((g) => g.isDefault) ?? rows[0];
        if (def) setGodownId(def.id);
      })
      .catch(() => setGodowns([]));
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items.slice(0, 40);
    return items
      .filter(
        (i) =>
          i.name.toLowerCase().includes(needle) ||
          (i.barcode ?? '').toLowerCase().includes(needle) ||
          (i.hsnSac ?? '').toLowerCase().includes(needle),
      )
      .slice(0, 40);
  }, [items, q]);

  const totals = useMemo(() => {
    let taxable = 0;
    let tax = 0;
    for (const l of cart) {
      const t = round2(l.qty * l.rate);
      taxable = round2(taxable + t);
      tax = round2(tax + (t * l.gstRate) / 100);
    }
    return { taxable, tax, grand: Math.round(taxable + tax) };
  }, [cart]);

  const addItem = (item: Item) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.itemId === item.id);
      if (existing) {
        return prev.map((l) =>
          l.itemId === item.id ? { ...l, qty: l.qty + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          key: `${item.id}-${Date.now()}`,
          itemId: item.id,
          description: item.name,
          hsnSac: item.hsnSac ?? undefined,
          qty: 1,
          rate: toNum(item.rate),
          gstRate: toNum(item.gstRate),
        },
      ];
    });
    setQ('');
  };

  const checkout = async () => {
    if (!cart.length) {
      setError('Add items to cart');
      return;
    }
    if (!partyName.trim()) {
      setError('Customer name required');
      return;
    }
    if (payMode === 'UPI' && !upiRef.trim()) {
      setError('UPI Ref ID required');
      return;
    }
    if (payMode === 'CARD' && !/^\d{4}$/.test(cardLast4.trim())) {
      setError('Card last 4 digits required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await invoicesApi.create({
        partyName: partyName.trim(),
        partyPhone: partyPhone || undefined,
        finalize: true,
        notes: 'POS sale',
        lines: cart.map((l) => ({
          itemId: l.itemId,
          description: l.description,
          hsnSac: l.hsnSac,
          qty: l.qty,
          rate: l.rate,
          gstRate: l.gstRate,
          godownId: godownId || undefined,
        })),
        payments: [
          {
            mode: payMode,
            amount: totals.grand,
            upiRefId: payMode === 'UPI' ? upiRef.trim() : undefined,
            cardLast4: payMode === 'CARD' ? cardLast4.trim() : undefined,
          },
        ],
      });
      setLastBill(created.billNo);
      setCart([]);
      setUpiRef('');
      setCardLast4('');
      navigate(`/app/bills/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        icon={<MonitorSmartphone size={22} />}
        title="POS"
        subtitle="Fast counter billing — scan/search, pay, print"
      />

      {error ? <Alert>{error}</Alert> : null}
      {lastBill ? (
        <Alert variant="success">Last bill: {lastBill}</Alert>
      ) : null}

      <div className="grid-2">
        <div className="panel">
          <Field label="Search / barcode" htmlFor="pos-q">
            <input
              id="pos-q"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filtered[0]) {
                  e.preventDefault();
                  addItem(filtered[0]);
                }
              }}
              placeholder="Type name or barcode, Enter to add"
            />
          </Field>
          <div className="pos-item-list">
            {filtered.length === 0 ? (
              <p className="muted">No items match this search.</p>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="pos-item"
                  onClick={() => addItem(item)}
                >
                  <strong>{item.name}</strong>
                  <span>{formatInr(toNum(item.rate))}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="panel">
          <div className="grid-2">
            <Field label="Customer" htmlFor="pos-c">
              <input
                id="pos-c"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
              />
            </Field>
            <Field label="Phone" htmlFor="pos-p">
              <input
                id="pos-p"
                value={partyPhone}
                onChange={(e) => setPartyPhone(e.target.value)}
              />
            </Field>
            {godowns.length ? (
              <Field label="Godown" htmlFor="pos-g">
                <select
                  id="pos-g"
                  value={godownId}
                  onChange={(e) => setGodownId(e.target.value)}
                >
                  {godowns.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
          </div>

          <h3>Cart</h3>
          {cart.length === 0 ? (
            <p className="muted">No items yet</p>
          ) : (
            <ul className="pos-cart">
              {cart.map((l) => (
                <li key={l.key}>
                  <div>
                    <strong>{l.description}</strong>
                    <div className="muted">
                      {formatInr(l.rate)} · GST {l.gstRate}%
                    </div>
                  </div>
                  <div className="pos-cart-qty">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() =>
                        setCart((prev) =>
                          prev
                            .map((x) =>
                              x.key === l.key
                                ? { ...x, qty: Math.max(1, x.qty - 1) }
                                : x,
                            )
                            .filter((x) => x.qty > 0),
                        )
                      }
                    >
                      −
                    </button>
                    <span>{l.qty}</span>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() =>
                        setCart((prev) =>
                          prev.map((x) =>
                            x.key === l.key ? { ...x, qty: x.qty + 1 } : x,
                          ),
                        )
                      }
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() =>
                        setCart((prev) => prev.filter((x) => x.key !== l.key))
                      }
                    >
                      ×
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="pos-totals">
            <div>
              Taxable <strong>{formatInr(totals.taxable)}</strong>
            </div>
            <div>
              Tax <strong>{formatInr(totals.tax)}</strong>
            </div>
            <div className="pos-grand">
              Total <strong>{formatInr(totals.grand)}</strong>
            </div>
          </div>

          <Field label="Payment" htmlFor="pos-pay">
            <select
              id="pos-pay"
              value={payMode}
              onChange={(e) => setPayMode(e.target.value as PaymentMode)}
            >
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
            </select>
          </Field>
          {payMode === 'UPI' ? (
            <Field label="UPI Ref ID" htmlFor="pos-upi">
              <input
                id="pos-upi"
                value={upiRef}
                onChange={(e) => setUpiRef(e.target.value)}
              />
            </Field>
          ) : null}
          {payMode === 'CARD' ? (
            <Field label="Card last 4" htmlFor="pos-card">
              <input
                id="pos-card"
                value={cardLast4}
                onChange={(e) =>
                  setCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))
                }
                inputMode="numeric"
                maxLength={4}
                placeholder="1234"
              />
            </Field>
          ) : null}

          <Button disabled={busy || !cart.length} onClick={() => void checkout()}>
            {busy ? 'Processing…' : `Charge ${formatInr(totals.grand)}`}
          </Button>
        </div>
      </div>
    </>
  );
}
