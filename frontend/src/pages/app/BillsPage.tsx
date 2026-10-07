import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi, brandingApi, invoicesApi, partiesApi } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import {
  actorDisplayName,
  actorRoleLabel,
  canCreateBills,
  canSoftDelete,
  canVoidBills,
  roleLabel,
} from '../../auth/roles';
import type {
  Invoice,
  InvoiceStatus,
  Party,
  PaymentMode,
  PrintFormat,
} from '../../types';
import { formatInr, todayIso, toNum } from '../../utils/format';
import { openInvoicePrint } from '../../utils/printInvoice';
import { useDialog } from '../../components/Dialog';
import {
  Alert,
  Button,
  DataTable,
  Field,
  PageHeader,
  StatusBadge,
} from '../../components/ui';
import { FileText } from 'lucide-react';

export function BillsPage() {
  const { user } = useAuth();
  const dialog = useDialog();
  const navigate = useNavigate();
  const [bills, setBills] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [status, setStatus] = useState<InvoiceStatus | ''>('');
  const [paymentStatus, setPaymentStatus] = useState<
    '' | 'UNPAID' | 'PARTIAL' | 'PAID'
  >('');
  const [documentType, setDocumentType] = useState<
    '' | 'TAX_INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE'
  >('');
  const [defaultPrintFormat, setDefaultPrintFormat] =
    useState<PrintFormat>('A4');
  // prefer user preference, else company branding
  const [partyId, setPartyId] = useState('');
  const [parties, setParties] = useState<Party[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const role = user?.role ?? '';
  const allowCreate = canCreateBills(role);
  const allowVoid = canVoidBills(role);
  const allowBin = canSoftDelete(role);
  const allowPay =
    role === 'CLIENT_ADMIN' ||
    role === 'BILLING_OPERATOR' ||
    role === 'ACCOUNTANT';

  const load = () => {
    setLoading(true);
    setError(null);
    invoicesApi
      .list({
        from: from || undefined,
        to: to || undefined,
        status: status || undefined,
        paymentStatus: paymentStatus || undefined,
        documentType: documentType || undefined,
        partyId: partyId || undefined,
        q: q || undefined,
      })
      .then(setBills)
      .catch((e) => {
        setError(e.message);
        setBills([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    void partiesApi.list().then(setParties).catch(() => setParties([]));
    void Promise.all([
      brandingApi.get().catch(() => null),
      authApi.me().catch(() => null),
    ]).then(([brand, me]) => {
      const fromUser = me?.preferredPrintFormat;
      const fromBrand = brand?.printFormat;
      if (fromUser) setDefaultPrintFormat(fromUser);
      else if (fromBrand) setDefaultPrintFormat(fromBrand);
    });
  }, []);

  const voidBill = async (id: string, billNo: string) => {
    const reason = await dialog.prompt({
      title: 'Void invoice',
      message: `Provide a reason to void ${billNo}. This cancels the bill but keeps it on the register.`,
      label: 'Void reason',
      placeholder: 'e.g. Incorrect amount / customer request',
      confirmLabel: 'Void bill',
      required: true,
      multiline: true,
      danger: true,
    });
    if (reason === null) return;
    try {
      setError(null);
      setSuccess(null);
      await invoicesApi.void(id, reason.trim());
      setSuccess(`${billNo} voided`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Void failed');
    }
  };

  const moveToBin = async (b: Invoice) => {
    const ok = await dialog.confirm({
      title: 'Move to recycle bin',
      message: `Move bill ${b.billNo} to the recycle bin? Staff can restore it later.`,
      confirmLabel: 'Move to bin',
      danger: true,
    });
    if (!ok) return;
    try {
      setError(null);
      setSuccess(null);
      await invoicesApi.softDelete(b.id);
      setSuccess(`${b.billNo} moved to recycle bin`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const recordPayment = async (b: Invoice) => {
    const due = toNum(b.balanceDue ?? b.grandTotal);
    if (due <= 0.01) {
      await dialog.alert({
        title: 'Already paid',
        message: `${b.billNo} has no balance due.`,
        variant: 'info',
      });
      return;
    }
    const amountRaw = await dialog.prompt({
      title: `Record payment · ${b.billNo}`,
      message: `Balance due ${formatInr(due)}. Enter amount received now.`,
      label: 'Amount (₹)',
      defaultValue: String(due),
      confirmLabel: 'Continue',
      required: true,
    });
    if (amountRaw === null) return;
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter a valid payment amount');
      return;
    }
    if (amount > due + 0.01) {
      setError(`Amount cannot exceed balance due (${formatInr(due)})`);
      return;
    }
    const modeRaw = await dialog.prompt({
      title: 'Payment mode',
      message: 'Type CASH, UPI, or CARD',
      label: 'Mode',
      defaultValue: 'CASH',
      confirmLabel: 'Continue',
      required: true,
    });
    if (modeRaw === null) return;
    const mode = modeRaw.trim().toUpperCase() as PaymentMode;
    if (mode !== 'CASH' && mode !== 'UPI' && mode !== 'CARD') {
      setError('Mode must be CASH, UPI, or CARD');
      return;
    }
    let upiRefId: string | undefined;
    let cardLast4: string | undefined;
    if (mode === 'UPI') {
      const ref = await dialog.prompt({
        title: 'UPI reference',
        label: 'UPI Ref ID',
        confirmLabel: 'Save payment',
        required: true,
      });
      if (ref === null) return;
      upiRefId = ref.trim();
    }
    if (mode === 'CARD') {
      const last4 = await dialog.prompt({
        title: 'Card',
        label: 'Last 4 digits',
        confirmLabel: 'Save payment',
        required: true,
      });
      if (last4 === null) return;
      if (!/^\d{4}$/.test(last4.trim())) {
        setError('Card last 4 must be 4 digits');
        return;
      }
      cardLast4 = last4.trim();
    }
    try {
      setError(null);
      setSuccess(null);
      await invoicesApi.addPayment(b.id, {
        mode,
        amount,
        upiRefId,
        cardLast4,
      });
      setSuccess(`Payment of ${formatInr(amount)} recorded on ${b.billNo}`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed');
    }
  };

  const printBill = async (id: string) => {
    const format = await dialog.prompt({
      title: 'Print bill',
      message: 'Choose paper format for this print.',
      label: 'Print format',
      defaultValue: defaultPrintFormat,
      confirmLabel: 'Print',
      options: [
        { value: 'A4', label: 'A4 (office / PDF)' },
        { value: 'THERMAL_80', label: 'Thermal 80mm (POS)' },
        { value: 'THERMAL_58', label: 'Thermal 58mm (compact)' },
      ],
    });
    if (!format) return;
    try {
      setError(null);
      await openInvoicePrint(() =>
        invoicesApi.print(id, format as PrintFormat),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Print failed');
    }
  };

  const shareEmail = async (id: string, billNo: string) => {
    const to = await dialog.prompt({
      title: 'Email invoice',
      message: `Send PDF for ${billNo} as an email attachment.`,
      label: 'Recipient email',
      placeholder: 'customer@example.com',
      inputType: 'email',
      confirmLabel: 'Send email',
      required: true,
    });
    if (!to?.trim()) return;
    try {
      setError(null);
      setSuccess(null);
      await invoicesApi.shareEmail(id, { to: to.trim() });
      setSuccess('Invoice emailed successfully');
      await dialog.alert({
        title: 'Email sent',
        message: `Invoice ${billNo} was emailed to ${to.trim()}.`,
        variant: 'success',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Email share failed');
    }
  };

  const shareWhatsapp = async (b: Invoice) => {
    const to = await dialog.prompt({
      title: 'WhatsApp invoice',
      message: `Send ${b.billNo} via WhatsApp. Include country code.`,
      label: 'Mobile number',
      placeholder: '919876543210',
      defaultValue: b.partyPhone?.replace(/\D/g, '') ?? '',
      inputType: 'tel',
      confirmLabel: 'Send',
      required: true,
    });
    if (!to?.trim()) return;
    try {
      setError(null);
      setSuccess(null);
      await invoicesApi.shareWhatsapp(b.id, { toE164: to.trim() });
      setSuccess('Invoice sent on WhatsApp');
      await dialog.alert({
        title: 'WhatsApp sent',
        message: `Invoice ${b.billNo} was sent to ${to.trim()}.`,
        variant: 'success',
      });
    } catch (e) {
      const msg = encodeURIComponent(
        `Invoice ${b.billNo} for ${formatInr(toNum(b.grandTotal))}`,
      );
      const phone = to.replace(/\D/g, '');
      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
      setError(e instanceof Error ? e.message : 'WhatsApp API share failed');
    }
  };

  return (
    <>
      <PageHeader
        icon={<FileText size={22} />}
        title="Bills"
        subtitle="Invoice register — see who raised and who voided each bill"
        actions={
          allowCreate ? (
            <Link to="/app/bills/new">
              <Button>New bill</Button>
            </Link>
          ) : null
        }
      />

      {error ? <Alert>{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}

      <div className="panel">
        <div className="filter-bar">
          <Field label="From" htmlFor="f-from">
            <input
              id="f-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="To" htmlFor="f-to">
            <input
              id="f-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <Field label="Bill status" htmlFor="f-status">
            <select
              id="f-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as InvoiceStatus | '')}
            >
              <option value="">All</option>
              <option value="DRAFT">Draft</option>
              <option value="FINALIZED">Finalized</option>
              <option value="VOID">Void</option>
            </select>
          </Field>
          <Field label="Payment" htmlFor="f-pay">
            <select
              id="f-pay"
              value={paymentStatus}
              onChange={(e) =>
                setPaymentStatus(
                  e.target.value as '' | 'UNPAID' | 'PARTIAL' | 'PAID',
                )
              }
            >
              <option value="">All payments</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIAL">Partial</option>
              <option value="PAID">Paid</option>
            </select>
          </Field>
          <Field label="Type" htmlFor="f-type">
            <select
              id="f-type"
              value={documentType}
              onChange={(e) =>
                setDocumentType(
                  e.target.value as
                    | ''
                    | 'TAX_INVOICE'
                    | 'CREDIT_NOTE'
                    | 'DEBIT_NOTE',
                )
              }
            >
              <option value="">All types</option>
              <option value="TAX_INVOICE">Invoice</option>
              <option value="CREDIT_NOTE">Credit note</option>
              <option value="DEBIT_NOTE">Debit note</option>
            </select>
          </Field>
          <Field label="Party" htmlFor="f-party">
            <select
              id="f-party"
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
            >
              <option value="">All parties</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Search" htmlFor="f-q" className="filter-grow">
            <input
              id="f-q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') load();
              }}
              placeholder="Bill no, party, phone, GSTIN…"
            />
          </Field>
          <div className="filter-bar-actions">
            <Button onClick={load}>Apply</Button>
            <Button
              variant="secondary"
              onClick={() => {
                const today = todayIso();
                setFrom(today);
                setTo(today);
                setStatus('');
                setPaymentStatus('');
                setDocumentType('');
                setPartyId('');
                setQ('');
                setLoading(true);
                setError(null);
                invoicesApi
                  .list({ from: today, to: today })
                  .then(setBills)
                  .catch((e) => {
                    setError(e.message);
                    setBills([]);
                  })
                  .finally(() => setLoading(false));
              }}
            >
              Reset
            </Button>
          </div>
        </div>
        <p className="filter-meta">
          Showing {bills.length} bill{bills.length === 1 ? '' : 's'}
          {paymentStatus === 'PARTIAL'
            ? ` · open dues ${formatInr(
                bills.reduce((s, b) => s + toNum(b.balanceDue), 0),
              )}`
            : ''}
        </p>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <DataTable
            columns={[
              { key: 'billNo', label: 'Bill No' },
              { key: 'type', label: 'Type' },
              { key: 'date', label: 'Date' },
              { key: 'party', label: 'Party' },
              { key: 'raisedBy', label: 'Raised by' },
              { key: 'finalizedBy', label: 'Finalized by' },
              { key: 'voidedBy', label: 'Voided by' },
              { key: 'total', label: 'Total', align: 'right' },
              { key: 'paid', label: 'Paid', align: 'right' },
              { key: 'due', label: 'Due', align: 'right' },
              { key: 'payStatus', label: 'Payment' },
              { key: 'status', label: 'Status' },
              { key: 'actions', label: '' },
            ]}
            rows={bills.map((b) => ({
              id: b.id,
              cells: {
                billNo: b.billNo,
                type:
                  b.documentType === 'CREDIT_NOTE'
                    ? 'CN'
                    : b.documentType === 'DEBIT_NOTE'
                      ? 'DN'
                      : 'INV',
                date: b.invoiceDate.slice(0, 10),
                party: b.partyName,
                raisedBy: (
                  <div className="actor-cell">
                    <span>{actorDisplayName(b.createdBy)}</span>
                    {actorRoleLabel(b.createdBy) ? (
                      <span
                        className={`role-badge role-${(
                          b.createdBy?.role || 'billing_operator'
                        ).toLowerCase()}`}
                      >
                        {actorRoleLabel(b.createdBy)}
                      </span>
                    ) : null}
                  </div>
                ),
                finalizedBy:
                  b.status === 'FINALIZED' || b.finalizedBy ? (
                    <div className="actor-cell">
                      <span>{actorDisplayName(b.finalizedBy)}</span>
                      {actorRoleLabel(b.finalizedBy) ? (
                        <span
                          className={`role-badge role-${(
                            b.finalizedBy?.role || 'billing_operator'
                          ).toLowerCase()}`}
                        >
                          {actorRoleLabel(b.finalizedBy)}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    '—'
                  ),
                voidedBy:
                  b.status === 'VOID' ? (
                    <div className="actor-cell">
                      <span>{actorDisplayName(b.voidedBy)}</span>
                      {b.voidedBy?.role ? (
                        <span
                          className={`role-badge role-${b.voidedBy.role.toLowerCase()}`}
                        >
                          {roleLabel(b.voidedBy.role)}
                        </span>
                      ) : null}
                      {b.voidReason ? (
                        <span className="muted" title={b.voidReason}>
                          {b.voidReason.length > 24
                            ? `${b.voidReason.slice(0, 24)}…`
                            : b.voidReason}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    '—'
                  ),
                total: formatInr(toNum(b.grandTotal)),
                paid: formatInr(toNum(b.amountPaid)),
                due: formatInr(toNum(b.balanceDue)),
                payStatus: b.paymentStatus ? (
                  <StatusBadge status={b.paymentStatus} />
                ) : (
                  '—'
                ),
                status: <StatusBadge status={b.status} />,
                actions: (
                  <div className="inline-actions">
                    <Button
                      variant="secondary"
                      onClick={() => navigate(`/app/bills/${b.id}`)}
                    >
                      Open
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => void printBill(b.id)}
                    >
                      Print
                    </Button>
                    {b.status === 'FINALIZED' &&
                    allowPay &&
                    toNum(b.balanceDue) > 0.01 ? (
                      <Button
                        variant="secondary"
                        onClick={() => void recordPayment(b)}
                      >
                        Record payment
                      </Button>
                    ) : null}
                    {b.status === 'FINALIZED' ? (
                      <>
                        {allowCreate ? (
                          <>
                            <Button
                              variant="secondary"
                              onClick={() => void shareEmail(b.id, b.billNo)}
                            >
                              Email
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => void shareWhatsapp(b)}
                            >
                              WhatsApp
                            </Button>
                          </>
                        ) : null}
                        {(allowCreate || allowVoid) &&
                        (!b.documentType || b.documentType === 'TAX_INVOICE') ? (
                          <>
                            <Button
                              variant="secondary"
                              onClick={() =>
                                navigate(`/app/notes/document?type=credit&ref=${b.id}`)
                              }
                            >
                              Credit note
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() =>
                                navigate(`/app/notes/document?type=debit&ref=${b.id}`)
                              }
                            >
                              Debit note
                            </Button>
                          </>
                        ) : null}
                        {allowVoid ? (
                          <Button
                            variant="danger"
                            onClick={() => void voidBill(b.id, b.billNo)}
                          >
                            Void
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                    {allowBin ? (
                      <Button
                        variant="secondary"
                        onClick={() => void moveToBin(b)}
                      >
                        Bin
                      </Button>
                    ) : null}
                  </div>
                ),
              },
            }))}
          />
        )}
      </div>
    </>
  );
}
