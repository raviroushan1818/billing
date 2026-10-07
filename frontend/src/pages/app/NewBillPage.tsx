import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Receipt, Trash2 } from 'lucide-react';
import { invoicesApi, inventoryApi, itemsApi, partiesApi } from '../../api';
import { useTenantProfile } from '../../hooks/useTenantProfile';
import type { Godown, Invoice, Item, Party, PaymentMode } from '../../types';
import {
  calcBillTotals,
  discountAmount,
  formatInr,
  lineTotal,
  round2,
  todayIso,
  toNum,
  type DiscountType,
} from '../../utils/format';
import { openInvoicePrint } from '../../utils/printInvoice';
import { compactPartyMeta, readPartyMeta } from '../../utils/partyMeta';
import { Alert, Button, Field, PageHeader } from '../../components/ui';
import { PaymentLedger, ReceivePaymentDialog } from '../../components/payments';
import { useAuth } from '../../auth/AuthContext';
import { PartySearch } from '../../components/PartySearch';

/** Number inputs may be blank (`''`) until the user types, except qty which defaults to 1. */
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
  discountType: DiscountType;
  gstRate: NumInput;
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
    qty: 1,
    rate: '',
    discount: '',
    discountType: 'INR',
    gstRate: 0,
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
    showPatientDemographics,
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
  const [age, setAge] = useState('');
  const [ageUnit, setAgeUnit] = useState<'Y' | 'M'>('Y');
  const [gender, setGender] = useState('');
  const [careOf, setCareOf] = useState('');
  const [partyId, setPartyId] = useState<string | undefined>();
  const [saveAsParty, setSaveAsParty] = useState(true);
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);
  const [itemSuggestKey, setItemSuggestKey] = useState<string | null>(null);
  const [itemSuggestIndex, setItemSuggestIndex] = useState(0);
  const [payments, setPayments] = useState<PaymentDraft[]>([
    { mode: 'CASH', enabled: true, amount: '', upiRefId: '', cardLast4: '' },
    { mode: 'UPI', enabled: false, amount: '', upiRefId: '', cardLast4: '' },
    { mode: 'CARD', enabled: false, amount: '', upiRefId: '', cardLast4: '' },
  ]);
  const [catalog, setCatalog] = useState<Item[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [defaultGodownId, setDefaultGodownId] = useState('');
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [readonly, setReadonly] = useState(false);
  const [loadedInvoice, setLoadedInvoice] = useState<Invoice | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [payNotice, setPayNotice] = useState<string | null>(null);
  const { user } = useAuth();
  const canReceivePayment =
    user?.role === 'CLIENT_ADMIN' ||
    user?.role === 'BILLING_OPERATOR' ||
    user?.role === 'ACCOUNTANT';

  const { subtotal, grandTotal, roundOff } = useMemo(
    () =>
      calcBillTotals(
        lines.map((l) => ({
          qty: toNum(l.qty),
          rate: toNum(l.rate),
          discount: toNum(l.discount),
          gstRate: toNum(l.gstRate),
          discountType: l.discountType,
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
        setLoadedInvoice(inv);
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
        const meta = readPartyMeta(
          inv.partyMeta as Record<string, unknown> | undefined,
        );
        setAge(meta.age ?? '');
        setAgeUnit(meta.ageUnit === 'M' ? 'M' : 'Y');
        setGender(meta.gender ?? '');
        setCareOf(meta.careOf ?? '');
        if (meta.class) setClassName(meta.class);
        else if (inv.notes?.startsWith('Class:')) {
          setClassName(inv.notes.replace(/^Class:\s*/, ''));
        }
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
              discountType: 'INR' as DiscountType,
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

  const selectParty = (p: Party) => {
    setSelectedParty(p);
    setPartyId(p.id);
    setSaveAsParty(false);
    setExternalId(p.externalId ?? '');
    setPhone(p.phone ?? '');
    setName(p.name);
    setRefBy(p.referredBy ?? '');
    setAddress(p.address ?? '');
    setGstin(p.gstin ?? '');
    const cf = p.customFields as Record<string, unknown> | undefined;
    const meta = readPartyMeta(cf);
    if (cf?.class) setClassName(String(cf.class));
    setAge(meta.age ?? '');
    setAgeUnit(meta.ageUnit === 'M' ? 'M' : 'Y');
    setGender(meta.gender ?? '');
    setCareOf(meta.careOf ?? '');
  };

  /** Back to a blank new party after "Change" on a selected one. */
  const clearParty = () => {
    setSelectedParty(null);
    setPartyId(undefined);
    setSaveAsParty(true);
    setExternalId('');
    setPhone('');
    setName('');
    setRefBy('');
    setAddress('');
    setGstin('');
    setClassName('');
    setAge('');
    setAgeUnit('Y');
    setGender('');
    setCareOf('');
  };

  const updateLine = (key: string, patch: Partial<LineDraft>) => {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  };

  const pickItem = (key: string, itemId: string) => {
    const item = catalog.find((i) => i.id === itemId);
    if (!item) return;
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        return {
          ...l,
          itemId,
          description: item.name,
          hsnSac: item.hsnSac ?? '',
          rate: toNum(item.rate),
          gstRate: toNum(item.gstRate),
          qty: l.qty === '' || toNum(l.qty) < 1 ? 1 : l.qty,
          saveToCatalog: false,
        };
      }),
    );
    setItemSuggestKey(null);
  };

  const filteredCatalog = (query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return catalog
      .filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.hsnSac ?? '').toLowerCase().includes(q) ||
          (i.barcode ?? '').toLowerCase().includes(q),
      )
      .slice(0, 12);
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
      // Empty GST is treated as 0% (common for hospital / exempt lines).
      if (l.gstRate !== '' && toNum(l.gstRate) < 0) {
        return 'GST% cannot be negative';
      }
      const disc = toNum(l.discount);
      if (l.discountType === 'PCT' && disc > 100) {
        return 'Discount % cannot exceed 100';
      }
      const lineValue = qty * toNum(l.rate);
      if (l.discountType === 'INR' && disc > lineValue + 0.001) {
        return 'Rupee discount cannot exceed item amount (qty × rate)';
      }
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
    partyMeta: compactPartyMeta({
      age,
      ageUnit,
      gender,
      careOf,
      class: className,
    }),
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
        discount: discountAmount(
          Math.round(toNum(l.qty)),
          toNum(l.rate),
          toNum(l.discount),
          l.discountType,
        ),
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

      let resolvedPartyId = partyId;
      if (saveAsParty && !resolvedPartyId && name.trim()) {
        const createdParty = await partiesApi.create({
          name: name.trim(),
          phone: phone || undefined,
          address: address || undefined,
          externalId: externalId || undefined,
          referredBy: refBy || undefined,
          gstin: gstin || undefined,
          customFields: compactPartyMeta({
            age,
            ageUnit,
            gender,
            careOf,
            class: className,
          }),
        });
        resolvedPartyId = createdParty.id;
        setPartyId(createdParty.id);
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
        partyId: resolvedPartyId,
        lines: resolvedLines
          .filter((l) => l.description.trim())
          .map((l) => ({
            itemId: l.itemId,
            description: l.description.trim(),
            hsnSac: l.hsnSac || undefined,
            qty: Math.round(toNum(l.qty)),
            rate: toNum(l.rate),
            discount: discountAmount(
              Math.round(toNum(l.qty)),
              toNum(l.rate),
              toNum(l.discount),
              l.discountType,
            ),
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
            {!readonly ? (
              <div className="party-search-row">
                <PartySearch
                  partyLabel={partyLabel}
                  partyIdLabel={partyIdLabel}
                  selected={selectedParty}
                  onSelect={selectParty}
                  onClear={clearParty}
                />
              </div>
            ) : null}
            <Field label={partyIdLabel} htmlFor="party-ext-id">
              <input
                id="party-ext-id"
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                placeholder="Optional"
                disabled={readonly}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                name="party-external-id"
              />
            </Field>
            <Field label="Phone" htmlFor="phone">
              <input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={readonly}
                autoComplete="off"
                name="party-phone"
              />
            </Field>
            <Field label={partyLabel} htmlFor="pname">
              <input
                id="pname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={readonly}
                autoComplete="off"
                name="party-name"
              />
            </Field>
            {showRefBy ? (
              <Field label="Ref By" htmlFor="refby">
                <input
                  id="refby"
                  value={refBy}
                  onChange={(e) => setRefBy(e.target.value)}
                  disabled={readonly}
                  placeholder="Consultant / referring doctor"
                  autoComplete="off"
                />
              </Field>
            ) : null}
            {showPatientDemographics ? (
              <>
                <Field label="Age" htmlFor="pat-age">
                  <div className="age-field">
                    <input
                      id="pat-age"
                      type="number"
                      min={0}
                      max={ageUnit === 'M' ? 36 : 120}
                      step={1}
                      inputMode="numeric"
                      placeholder="e.g. 45"
                      value={age}
                      onChange={(e) =>
                        setAge(e.target.value.replace(/[^\d]/g, '').slice(0, 3))
                      }
                      disabled={readonly}
                    />
                    <select
                      aria-label="Age unit"
                      value={ageUnit}
                      onChange={(e) =>
                        setAgeUnit(e.target.value === 'M' ? 'M' : 'Y')
                      }
                      disabled={readonly}
                    >
                      <option value="Y">Years</option>
                      <option value="M">Months</option>
                    </select>
                  </div>
                </Field>
                <Field label="Gender" htmlFor="pat-gender">
                  <select
                    id="pat-gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    disabled={readonly}
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </Field>
                <Field label="Care of (C/O)" htmlFor="pat-careof">
                  <input
                    id="pat-careof"
                    value={careOf}
                    onChange={(e) => setCareOf(e.target.value)}
                    disabled={readonly}
                    placeholder="Guardian / attendant"
                    autoComplete="off"
                  />
                </Field>
              </>
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
            {!partyId && !readonly ? (
              <Field label=" ">
                <label className="field-label" style={{ marginTop: '0.35rem' }}>
                  <input
                    type="checkbox"
                    checked={saveAsParty}
                    onChange={(e) => setSaveAsParty(e.target.checked)}
                    style={{ width: 'auto', marginRight: '0.35rem' }}
                  />
                  Save this patient as a party for future bills
                </label>
              </Field>
            ) : null}
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
                {lines.map((line, idx) => {
                  const matches = filteredCatalog(line.description);
                  const menuOpen =
                    !readonly &&
                    itemSuggestKey === line.key &&
                    line.description.trim().length > 0;
                  return (
                  <tr key={line.key}>
                    <td>{idx + 1}</td>
                    <td>
                      <div className="item-suggest">
                        <input
                          value={line.description}
                          onChange={(e) => {
                            updateLine(line.key, {
                              description: e.target.value,
                              itemId: undefined,
                            });
                            setItemSuggestKey(line.key);
                            setItemSuggestIndex(0);
                          }}
                          onFocus={() => {
                            if (line.description.trim()) {
                              setItemSuggestKey(line.key);
                              setItemSuggestIndex(0);
                            }
                          }}
                          onBlur={() => {
                            window.setTimeout(() => {
                              setItemSuggestKey((k) =>
                                k === line.key ? null : k,
                              );
                            }, 160);
                          }}
                          onKeyDown={(e) => {
                            if (!menuOpen) return;
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              setItemSuggestKey(null);
                              return;
                            }
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setItemSuggestIndex((i) =>
                                matches.length
                                  ? Math.min(i + 1, matches.length - 1)
                                  : 0,
                              );
                              return;
                            }
                            if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setItemSuggestIndex((i) => Math.max(i - 1, 0));
                              return;
                            }
                            if (e.key === 'Enter' && matches.length) {
                              e.preventDefault();
                              const pick =
                                matches[
                                  Math.min(itemSuggestIndex, matches.length - 1)
                                ];
                              if (pick) pickItem(line.key, pick.id);
                            }
                          }}
                          placeholder="Type to search catalog or enter item…"
                          disabled={readonly}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          name={`bill-item-${line.key}`}
                          role="combobox"
                          aria-expanded={menuOpen}
                          aria-autocomplete="list"
                          aria-controls={`item-suggest-${line.key}`}
                        />
                        {menuOpen ? (
                          <div
                            id={`item-suggest-${line.key}`}
                            className="item-suggest-menu"
                            role="listbox"
                          >
                            {matches.length ? (
                              matches.map((i, mi) => (
                                <button
                                  key={i.id}
                                  type="button"
                                  role="option"
                                  aria-selected={mi === itemSuggestIndex}
                                  className={
                                    mi === itemSuggestIndex
                                      ? 'is-active'
                                      : undefined
                                  }
                                  onMouseDown={(e) => e.preventDefault()}
                                  onMouseEnter={() => setItemSuggestIndex(mi)}
                                  onClick={() => pickItem(line.key, i.id)}
                                >
                                  <span className="item-suggest-name">
                                    {i.name}
                                  </span>
                                  <span className="item-suggest-meta">
                                    {i.hsnSac ? `HSN ${i.hsnSac} · ` : ''}
                                    {formatInr(toNum(i.rate))}
                                    {toNum(i.gstRate)
                                      ? ` · ${toNum(i.gstRate)}%`
                                      : ''}
                                  </span>
                                </button>
                              ))
                            ) : (
                              <div className="item-suggest-empty">
                                No catalog match — continue typing for a custom
                                line item
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                      {!readonly && !line.itemId && line.description.trim() ? (
                        <label
                          className="field-label"
                          style={{ marginTop: '0.35rem' }}
                        >
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
                        autoComplete="off"
                        name={`bill-hsn-${line.key}`}
                      />
                    </td>
                    <td className="num">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        title="Quantity (whole number)"
                        value={line.qty}
                        onChange={(e) =>
                          updateLine(line.key, {
                            qty: parseQtyInput(e.target.value),
                          })
                        }
                        onBlur={() => {
                          if (line.qty === '' || toNum(line.qty) < 1) {
                            updateLine(line.key, { qty: 1 });
                          }
                        }}
                        disabled={readonly}
                      />
                    </td>
                    <td className="num">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0"
                        title="Rate"
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
                      <div className="disc-cell">
                        <div
                          className="disc-type-toggle"
                          role="group"
                          aria-label="Discount type"
                        >
                          <button
                            type="button"
                            className={
                              line.discountType === 'INR' ? 'is-active' : undefined
                            }
                            disabled={readonly}
                            title="Rupee discount"
                            aria-pressed={line.discountType === 'INR'}
                            onClick={() => {
                              if (line.discountType === 'INR') return;
                              const qty = toNum(line.qty);
                              const rate = toNum(line.rate);
                              const lineValue = qty * rate;
                              const pct = toNum(line.discount);
                              updateLine(line.key, {
                                discountType: 'INR',
                                discount:
                                  lineValue > 0 && line.discount !== ''
                                    ? round2((lineValue * pct) / 100)
                                    : line.discount,
                              });
                            }}
                          >
                            ₹
                          </button>
                          <button
                            type="button"
                            className={
                              line.discountType === 'PCT' ? 'is-active' : undefined
                            }
                            disabled={readonly}
                            title="Percentage discount"
                            aria-pressed={line.discountType === 'PCT'}
                            onClick={() => {
                              if (line.discountType === 'PCT') return;
                              const qty = toNum(line.qty);
                              const rate = toNum(line.rate);
                              const lineValue = qty * rate;
                              const amt = toNum(line.discount);
                              updateLine(line.key, {
                                discountType: 'PCT',
                                discount:
                                  lineValue > 0 && line.discount !== ''
                                    ? round2(
                                        Math.min(100, (amt / lineValue) * 100),
                                      )
                                    : line.discount,
                              });
                            }}
                          >
                            %
                          </button>
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={line.discountType === 'PCT' ? 100 : undefined}
                          step="0.01"
                          placeholder="0"
                          value={line.discount}
                          onChange={(e) =>
                            updateLine(line.key, {
                              discount: parseDecimalInput(e.target.value),
                            })
                          }
                          disabled={readonly}
                          autoComplete="off"
                          name={`bill-disc-${line.key}`}
                          aria-label={
                            line.discountType === 'PCT'
                              ? 'Discount percent'
                              : 'Discount amount in rupees'
                          }
                        />
                      </div>
                      {line.discountType === 'PCT' &&
                      toNum(line.discount) > 0 &&
                      toNum(line.qty) > 0 &&
                      toNum(line.rate) > 0 ? (
                        <div className="disc-hint">
                          ={' '}
                          {formatInr(
                            discountAmount(
                              toNum(line.qty),
                              toNum(line.rate),
                              toNum(line.discount),
                              'PCT',
                            ),
                          )}
                        </div>
                      ) : null}
                    </td>
                    <td className="num">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0"
                        title="GST %"
                        value={line.gstRate}
                        onChange={(e) =>
                          updateLine(line.key, {
                            gstRate: parseDecimalInput(e.target.value),
                          })
                        }
                        onBlur={() => {
                          if (line.gstRate === '') {
                            updateLine(line.key, { gstRate: 0 });
                          }
                        }}
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
                          line.discountType,
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
                  );
                })}
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
          {!readonly ? (
            <p className="muted" style={{ marginTop: 0 }}>
              Pay the full amount, or enter less to leave a{' '}
              <strong>balance due</strong> (partial / credit sale). Leave amounts
              at 0 for a full credit bill.
            </p>
          ) : null}
          {readonly && loadedInvoice ? (
            <>
              {payNotice ? <Alert variant="success">{payNotice}</Alert> : null}
              <PaymentLedger
                invoice={loadedInvoice}
                onChanged={(updated) => {
                  setLoadedInvoice(updated);
                  setPayNotice('Payment reversed — balance due updated.');
                }}
              />
              {loadedInvoice.status === 'FINALIZED' &&
              canReceivePayment &&
              toNum(loadedInvoice.balanceDue) > 0.01 ? (
                <div className="btn-group" style={{ marginTop: '0.75rem' }}>
                  <Button onClick={() => setReceiving(true)}>
                    Receive payment
                  </Button>
                </div>
              ) : null}
              {receiving ? (
                <ReceivePaymentDialog
                  invoice={loadedInvoice}
                  onClose={() => setReceiving(false)}
                  onSaved={(updated, receipt) => {
                    setReceiving(false);
                    setLoadedInvoice(updated);
                    setPayNotice(
                      receipt.settled
                        ? `Received ${formatInr(receipt.amount)} — bill settled in full.`
                        : `Received ${formatInr(receipt.amount)} · balance due ${formatInr(updated.balanceDue)}`,
                    );
                  }}
                />
              ) : null}
            </>
          ) : (
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
          )}
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
                  . Collect later with Receive payment on the bill.
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
