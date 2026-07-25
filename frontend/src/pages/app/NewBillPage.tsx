import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Receipt, Trash2 } from 'lucide-react';
import { invoicesApi, inventoryApi, itemsApi, partiesApi } from '../../api';
import { useTenantProfile } from '../../hooks/useTenantProfile';
import type { Godown, Item, Party, PaymentMode } from '../../types';
import {
  calcBillTotals,
  formatInr,
  lineTotal,
  round2,
  todayIso,
  toNum,
} from '../../utils/format';
import { openInvoicePrint } from '../../utils/printInvoice';
import { Alert, Button, Field, PageHeader } from '../../components/ui';

/** Empty string keeps number inputs blank until the user types. */
type NumInput = number | '';

type LineDraft = {
  key: string;
  itemId?: string;
  godownId?: string;
  description: string;
  hsnSac: string;
  qty: NumInput;
  rate: NumInput;
  discount: NumInput;
  gstRate: NumInput;
  itemQuery?: string;
  saveToCatalog?: boolean;
};

type PaymentDraft = {
  mode: PaymentMode;
  enabled: boolean;
  amount: NumInput;
  upiRefId: string;
  cardLast4: string;
};

let lineKey = 0;
let defaultGodownForNewLines = '';
function newLine(): LineDraft {
  return {
    key: `line-${++lineKey}`,
    description: '',
    hsnSac: '',
    qty: '',
    rate: '',
    discount: '',
    gstRate: '',
    itemQuery: '',
    saveToCatalog: false,
    godownId: defaultGodownForNewLines || undefined,
  };
}

function parseDecimalInput(raw: string): NumInput {
  if (raw === '') return '';
  const n = Number(raw);
  return Number.isFinite(n) ? n : '';
}

function parseQtyInput(raw: string): NumInput {
  if (raw === '') return '';
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : '';
}

export function NewBillPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    partyLabel,
    partyIdLabel,
    showRefBy,
    showGstinProminent,
    showClassField,
    invoiceTitle,
  } = useTenantProfile();

  const [billNo, setBillNo] = useState('Auto on save');
  const [invoiceDate, setInvoiceDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState('');
  const [externalId, setExternalId] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [refBy, setRefBy] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [className, setClassName] = useState('');
  const [partyId, setPartyId] = useState<string | undefined>();
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);
  const [payments, setPayments] = useState<PaymentDraft[]>([
    { mode: 'CASH', enabled: true, amount: '', upiRefId: '', cardLast4: '' },
    { mode: 'UPI', enabled: false, amount: '', upiRefId: '', cardLast4: '' },
    { mode: 'CARD', enabled: false, amount: '', upiRefId: '', cardLast4: '' },
  ]);
  const [catalog, setCatalog] = useState<Item[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [defaultGodownId, setDefaultGodownId] = useState('');
  const [searchResults, setSearchResults] = useState<Party[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [readonly, setReadonly] = useState(false);

  const { subtotal, grandTotal, roundOff } = useMemo(
    () =>
      calcBillTotals(
        lines.map((l) => ({
          qty: toNum(l.qty),
          rate: toNum(l.rate),
          discount: toNum(l.discount),
          gstRate: toNum(l.gstRate),
        })),
      ),
    [lines],
  );

  const paymentSum = useMemo(
    () =>
      round2(
        payments
          .filter((p) => p.enabled)
          .reduce((s, p) => s + toNum(p.amount), 0),
      ),
    [payments],
  );

  const loadCatalog = useCallback(() => {
    itemsApi.list().then(setCatalog).catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    loadCatalog();
    void inventoryApi
      .listGodowns()
      .then((rows) => {
        setGodowns(rows);
        const def = rows.find((g) => g.isDefault) ?? rows[0];
        if (def) {
          setDefaultGodownId(def.id);
          defaultGodownForNewLines = def.id;
          setLines((prev) =>
            prev.map((l) => (l.godownId ? l : { ...l, godownId: def.id })),
          );
        }
      })
      .catch(() => setGodowns([]));
  }, [loadCatalog]);

  useEffect(() => {
    if (!id) return;
    invoicesApi
      .get(id)
      .then((inv) => {
        setBillNo(inv.billNo);
        setInvoiceDate(inv.invoiceDate.slice(0, 10));
        setDueDate(inv.dueDate ? inv.dueDate.slice(0, 10) : '');
        setExternalId(inv.partyExternalId ?? '');
        setPhone(inv.partyPhone ?? '');
        setName(inv.partyName);
        setRefBy(inv.referredBy ?? '');
        setAddress(inv.partyAddress ?? '');
        setGstin(inv.partyGstin ?? '');
        setPartyId(inv.partyId ?? undefined);
        setReadonly(inv.status !== 'DRAFT');
        if (inv.lines?.length) {
          setLines(
            inv.lines.map((l) => ({
              key: l.id ?? `line-${++lineKey}`,
              itemId: l.itemId ?? undefined,
              godownId: l.godownId ?? undefined,
              description: l.description,
              hsnSac: l.hsnSac ?? '',
              qty: Math.round(toNum(l.qty)),
              rate: toNum(l.rate),
              discount: toNum(l.discount),
              gstRate: toNum(l.gstRate),
            })),
          );
        }
        if (inv.payments?.length) {
          setPayments(
            (['CASH', 'UPI', 'CARD'] as PaymentMode[]).map((mode) => {
              const p = inv.payments!.find((x) => x.mode === mode);
              return {
                mode,
                enabled: !!p,
                amount: p ? toNum(p.amount) : '',
                upiRefId: p?.upiRefId ?? '',
                cardLast4: p?.cardLast4 ?? '',
              };
            }),
          );
        }
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    if (readonly) return;
    setPayments((prev) => {
      const enabled = prev.filter((p) => p.enabled);
      if (enabled.length !== 1) return prev;
      return prev.map((p) => {
        if (!p.enabled) return p;
        const amt = toNum(p.amount);
        // Keep intentional partial payments when lines change.
        if (amt > 0.01 && amt + 0.01 < grandTotal) return p;
        return { ...p, amount: grandTotal };
      });
    });
  }, [grandTotal, readonly]);

  const searchParty = async (q: string) => {
    setExternalId(q);
    if (q.length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    try {
      const results = await partiesApi.search(q);
      setSearchResults(results);
      setSearchOpen(results.length > 0);
    } catch {
      setSearchResults([]);
    }
  };

  const selectParty = (p: Party) => {
    setPartyId(p.id);
    setExternalId(p.externalId ?? '');
    setPhone(p.phone ?? '');
    setName(p.name);
    setRefBy(p.referredBy ?? '');
    setAddress(p.address ?? '');
    setGstin(p.gstin ?? '');
    const cf = p.customFields as Record<string, string> | undefined;
    if (cf?.class) setClassName(cf.class);
    setSearchOpen(false);
  };

  const updateLine = (key: string, patch: Partial<LineDraft>) => {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  };

  const pickItem = (key: string, itemId: string) => {
    const item = catalog.find((i) => i.id === itemId);
    if (!item) return;
    updateLine(key, {
      itemId,
      description: item.name,
      hsnSac: item.hsnSac ?? '',
      rate: toNum(item.rate),
      gstRate: toNum(item.gstRate),
      itemQuery: item.name,
      saveToCatalog: false,
    });
  };

  const filteredCatalog = (query: string) => {
    const q = query.trim().toLowerCase();
    // Only show suggestions once the user starts typing
    if (!q) return [];
    return catalog
      .filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.hsnSac ?? '').toLowerCase().includes(q) ||
          (i.barcode ?? '').toLowerCase().includes(q),
      )
      .slice(0, 20);
  };

  const validate = (): string | null => {
    if (!name.trim()) return `${partyLabel} is required`;
    const activeLines = lines.filter((l) => l.description.trim());
    if (!activeLines.length) return 'Add at least one item';
    for (const l of activeLines) {
      const qty = toNum(l.qty);
      if (l.qty === '' || !Number.isInteger(qty) || qty < 1) {
        return 'Quantity must be a whole number (1, 2, 3…)';
      }
      if (l.rate === '') return 'Rate is required for each item';
      if (l.gstRate === '') return 'GST% is required for each item';
    }
    const enabled = payments.filter((p) => p.enabled);
    if (!enabled.length && paymentSum > 0.01) {
      return 'Select at least one payment mode';
    }
    if (paymentSum - grandTotal > 0.01) {
      return `Payment total (${formatInr(paymentSum)}) cannot exceed grand total (${formatInr(grandTotal)})`;
    }
    for (const p of enabled) {
      if (p.mode === 'UPI' && !p.upiRefId.trim()) {
        return 'UPI Ref ID is required for UPI payments';
      }
      if (p.mode === 'CARD' && !/^\d{4}$/.test(p.cardLast4)) {
        return 'Card last 4 digits required for card payments';
      }
    }
    return null;
  };

  const buildPayload = () => ({
    invoiceDate,
    dueDate: dueDate || undefined,
    partyId,
    partyName: name.trim(),
    partyPhone: phone || undefined,
    partyAddress: address || undefined,
    partyGstin: gstin || undefined,
    partyExternalId: externalId || undefined,
    referredBy: refBy || undefined,
    notes:
      showClassField && className.trim()
        ? `Class: ${className.trim()}`
        : undefined,
    lines: lines
      .filter((l) => l.description.trim())
      .map((l) => ({
        itemId: l.itemId,
        description: l.description.trim(),
        hsnSac: l.hsnSac || undefined,
        qty: Math.round(toNum(l.qty)),
        rate: toNum(l.rate),
        discount: toNum(l.discount),
        gstRate: toNum(l.gstRate),
        godownId: l.godownId || undefined,
      })),
    payments: payments
      .filter((p) => p.enabled && toNum(p.amount) > 0)
      .map((p) => ({
        mode: p.mode,
        amount: round2(toNum(p.amount)),
        upiRefId: p.mode === 'UPI' ? p.upiRefId : undefined,
        cardLast4: p.mode === 'CARD' ? p.cardLast4 : undefined,
      })),
  });

  const save = async (andPrint = false) => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (id && readonly) {
        throw new Error('This bill cannot be edited');
      }

      const resolvedLines = [...lines];
      for (let i = 0; i < resolvedLines.length; i++) {
        const l = resolvedLines[i];
        if (l.saveToCatalog && !l.itemId && l.description.trim()) {
          const createdItem = await itemsApi.create({
            name: l.description.trim(),
            hsnSac: l.hsnSac || undefined,
            rate: toNum(l.rate),
            gstRate: toNum(l.gstRate) || 18,
            unit: 'NOS',
          });
          resolvedLines[i] = { ...l, itemId: createdItem.id };
          setCatalog((prev) => [...prev, createdItem]);
        }
      }
      setLines(resolvedLines);

      const payload = {
        ...buildPayload(),
        lines: resolvedLines
          .filter((l) => l.description.trim())
          .map((l) => ({
            itemId: l.itemId,
            description: l.description.trim(),
            hsnSac: l.hsnSac || undefined,
            qty: Math.round(toNum(l.qty)),
            rate: toNum(l.rate),
            discount: toNum(l.discount),
            gstRate: toNum(l.gstRate),
            godownId: l.godownId || undefined,
          })),
        finalize: true,
      };

      const saved = id
        ? await invoicesApi.updateDraft(id, payload)
        : await invoicesApi.create(payload);
      const invoiceId = saved.id;
      setBillNo(saved.billNo);
      setReadonly(true);

      if (andPrint) {
        await openInvoicePrint(() => invoicesApi.print(invoiceId));
      }
      navigate(`/app/bills/${invoiceId}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        icon={<Receipt size={22} />}
        title={
          id
            ? readonly
              ? `Bill ${billNo}`
              : `Edit draft ${billNo || ''}`.trim()
            : 'New Bill'
        }
        subtitle={invoiceTitle}
        actions={
          <Button variant="secondary" onClick={() => navigate('/app/bills')}>
            Cancel
          </Button>
        }
      />

      {error ? <Alert>{error}</Alert> : null}

      <div className="panel">
        <div className="bill-form-section">
          <h3>Bill details</h3>
          <div className="grid-4">
            <Field label="Bill No">
              <input readOnly value={billNo} />
            </Field>
            <Field label="Date" htmlFor="inv-date">
              <input
                id="inv-date"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                disabled={readonly}
              />
            </Field>
            <Field
              label="Due date (if credit / partial)"
              htmlFor="due-date"
              hint="Optional — used for receivables ageing"
            >
              <input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={readonly}
              />
            </Field>
            {godowns.length ? (
              <Field label="Default godown" htmlFor="def-godown">
                <select
                  id="def-godown"
                  value={defaultGodownId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDefaultGodownId(v);
                    defaultGodownForNewLines = v;
                    if (!readonly) {
                      setLines((prev) =>
                        prev.map((l) => ({ ...l, godownId: v || undefined })),
                      );
                    }
                  }}
                  disabled={readonly}
                >
                  {godowns.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                      {g.isDefault ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            <Field label={partyIdLabel}>
              <div className="search-dropdown">
                <input
                  value={externalId}
                  onChange={(e) => void searchParty(e.target.value)}
                  placeholder={`Search ${partyIdLabel}`}
                  disabled={readonly}
                />
                {searchOpen ? (
                  <div className="search-results">
                    {searchResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectParty(p)}
                      >
                        {p.externalId ?? '—'} · {p.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </Field>
            <Field label="Phone" htmlFor="phone">
              <input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={readonly}
              />
            </Field>
            <Field label={partyLabel} htmlFor="pname">
              <input
                id="pname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={readonly}
              />
            </Field>
            {showRefBy ? (
              <Field label="Ref By" htmlFor="refby">
                <input
                  id="refby"
                  value={refBy}
                  onChange={(e) => setRefBy(e.target.value)}
                  disabled={readonly}
                />
              </Field>
            ) : null}
            {showGstinProminent ? (
              <Field label="GSTIN" htmlFor="gstin">
                <input
                  id="gstin"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  disabled={readonly}
                />
              </Field>
            ) : null}
            {showClassField ? (
              <Field label="Class" htmlFor="class">
                <input
                  id="class"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  disabled={readonly}
                />
              </Field>
            ) : null}
            <Field label="Address" htmlFor="addr">
              <input
                id="addr"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={readonly}
              />
            </Field>
          </div>
        </div>

        <div className="bill-form-section">
          <h3>Items</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Items</th>
                  <th>Godown</th>
                  <th>HSN</th>
                  <th className="num">Qty</th>
                  <th className="num">Rate</th>
                  <th className="num">Disc</th>
                  <th className="num">GST%</th>
                  <th className="num">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={line.key}>
                    <td>{idx + 1}</td>
                    <td>
                      {!readonly ? (
                        <div className="item-picker">
                          <input
                            value={line.itemQuery ?? ''}
                            onChange={(e) =>
                              updateLine(line.key, {
                                itemQuery: e.target.value,
                                itemId: undefined,
                              })
                            }
                            placeholder="Search catalog or type to filter…"
                            list={`items-${line.key}`}
                          />
                          <datalist id={`items-${line.key}`}>
                            {filteredCatalog(line.itemQuery ?? '').map((i) => (
                              <option key={i.id} value={i.name} />
                            ))}
                          </datalist>
                          {(line.itemQuery ?? '').trim() ? (
                            <div className="btn-group" style={{ marginTop: '0.25rem' }}>
                              {filteredCatalog(line.itemQuery ?? '')
                                .slice(0, 5)
                                .map((i) => (
                                  <button
                                    key={i.id}
                                    type="button"
                                    className="btn btn-ghost"
                                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                                    onClick={() => pickItem(line.key, i.id)}
                                  >
                                    {i.name}
                                  </button>
                                ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <input
                        value={line.description}
                        onChange={(e) =>
                          updateLine(line.key, {
                            description: e.target.value,
                            itemId: undefined,
                          })
                        }
                        placeholder="Item description (manual OK)"
                        disabled={readonly}
                      />
                      {!readonly && !line.itemId && line.description.trim() ? (
                        <label className="field-label" style={{ marginTop: '0.25rem' }}>
                          <input
                            type="checkbox"
                            checked={!!line.saveToCatalog}
                            onChange={(e) =>
                              updateLine(line.key, {
                                saveToCatalog: e.target.checked,
                              })
                            }
                            style={{ width: 'auto', marginRight: '0.35rem' }}
                          />
                          Save to catalog
                        </label>
                      ) : null}
                    </td>
                    <td>
                      {godowns.length ? (
                        <select
                          value={line.godownId ?? ''}
                          onChange={(e) =>
                            updateLine(line.key, {
                              godownId: e.target.value || undefined,
                            })
                          }
                          disabled={readonly}
                        >
                          <option value="">Default</option>
                          {godowns.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <input
                        value={line.hsnSac}
                        onChange={(e) =>
                          updateLine(line.key, { hsnSac: e.target.value })
                        }
                        disabled={readonly}
                      />
                    </td>
                    <td className="num">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        placeholder=""
                        value={line.qty}
                        onChange={(e) =>
                          updateLine(line.key, {
                            qty: parseQtyInput(e.target.value),
                          })
                        }
                        disabled={readonly}
                      />
                    </td>
                    <td className="num">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder=""
                        value={line.rate}
                        onChange={(e) =>
                          updateLine(line.key, {
                            rate: parseDecimalInput(e.target.value),
                          })
                        }
                        disabled={readonly}
                      />
                    </td>
                    <td className="num">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder=""
                        value={line.discount}
                        onChange={(e) =>
                          updateLine(line.key, {
                            discount: parseDecimalInput(e.target.value),
                          })
                        }
                        disabled={readonly}
                      />
                    </td>
                    <td className="num">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder=""
                        value={line.gstRate}
                        onChange={(e) =>
                          updateLine(line.key, {
                            gstRate: parseDecimalInput(e.target.value),
                          })
                        }
                        disabled={readonly}
                      />
                    </td>
                    <td className="num">
                      {formatInr(
                        lineTotal(
                          toNum(line.qty),
                          toNum(line.rate),
                          toNum(line.discount),
                          toNum(line.gstRate),
                        ),
                      )}
                    </td>
                    <td>
                      {!readonly && lines.length > 1 ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() =>
                            setLines((prev) =>
                              prev.filter((l) => l.key !== line.key),
                            )
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!readonly ? (
            <Button
              variant="secondary"
              onClick={() => setLines((prev) => [...prev, newLine()])}
            >
              <Plus size={14} /> Add row
            </Button>
          ) : null}

          <div className="totals-block">
            <div className="totals-line">
              <span>Items total</span>
              <span>{formatInr(subtotal)}</span>
            </div>
            {roundOff !== 0 ? (
              <div className="totals-line">
                <span>Round off</span>
                <span>{formatInr(roundOff)}</span>
              </div>
            ) : null}
            <div className="grand-total-row">
              <span>Amount payable</span>
              <strong>{formatInr(grandTotal)}</strong>
            </div>
          </div>
        </div>

        <div className="bill-form-section">
          <h3>Payment</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Enter qty on each line first. Pay full amount, or enter less to leave
            a <strong>balance due</strong> (partial / credit sale). Leave all
            amounts at 0 for a full credit bill.
          </p>
          <div className="payment-modes">
            {payments.map((p, i) => (
              <div key={p.mode} className="payment-row">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    disabled={readonly}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setPayments((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, enabled } : x,
                        ),
                      );
                    }}
                  />
                  {p.mode}
                </label>
                <Field label="Amount">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder=""
                    value={p.enabled ? p.amount : ''}
                    disabled={!p.enabled || readonly}
                    onChange={(e) => {
                      const amount = parseDecimalInput(e.target.value);
                      setPayments((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, amount } : x,
                        ),
                      );
                    }}
                  />
                </Field>
                {p.mode === 'UPI' ? (
                  <Field label="UPI Ref ID">
                    <input
                      value={p.upiRefId}
                      disabled={!p.enabled || readonly}
                      onChange={(e) => {
                        const upiRefId = e.target.value;
                        setPayments((prev) =>
                          prev.map((x, j) =>
                            j === i ? { ...x, upiRefId } : x,
                          ),
                        );
                      }}
                    />
                  </Field>
                ) : p.mode === 'CARD' ? (
                  <Field label="Card last 4">
                    <input
                      maxLength={4}
                      value={p.cardLast4}
                      disabled={!p.enabled || readonly}
                      onChange={(e) => {
                        const cardLast4 = e.target.value.replace(/\D/g, '');
                        setPayments((prev) =>
                          prev.map((x, j) =>
                            j === i ? { ...x, cardLast4 } : x,
                          ),
                        );
                      }}
                    />
                  </Field>
                ) : (
                  <div />
                )}
              </div>
            ))}
          </div>
          {!readonly ? (
            <div className="payment-due-summary">
              <div>
                Received now: <strong>{formatInr(paymentSum)}</strong>
              </div>
              {paymentSum - grandTotal > 0.01 ? (
                <Alert>
                  Payment exceeds amount payable ({formatInr(grandTotal)}).
                </Alert>
              ) : grandTotal > 0.01 && grandTotal - paymentSum > 0.01 ? (
                <Alert variant="info">
                  Balance due{' '}
                  <strong>
                    {formatInr(Math.max(0, grandTotal - paymentSum))}
                  </strong>
                  {dueDate ? ` · due ${dueDate}` : ' · set a due date above'}
                  . Collect later from Bills → Record payment.
                </Alert>
              ) : grandTotal > 0.01 ? (
                <p className="muted">Fully paid — no balance due.</p>
              ) : (
                <p className="muted">
                  Enter quantity on line items to calculate amount payable.
                </p>
              )}
            </div>
          ) : null}
        </div>

        {!readonly ? (
          <div className="btn-group">
            <Button variant="secondary" onClick={() => navigate('/app/bills')}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void save(false)}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
            <Button disabled={busy} onClick={() => void save(true)}>
              {busy ? 'Saving…' : 'Save & Print'}
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}
