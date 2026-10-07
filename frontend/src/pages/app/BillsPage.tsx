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
import type { Invoice, InvoiceStatus, Party, PrintFormat } from '../../types';
import { formatDate, formatInr, todayIso, toNum } from '../../utils/format';
import {
  PaymentHistoryDialog,
  ReceivePaymentDialog,
} from '../../components/payments';
import { openInvoicePrint } from '../../utils/printInvoice';
import { useDialog } from '../../components/Dialog';
import { ActionMenu } from '../../components/ActionMenu';
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
  const [payingFor, setPayingFor] = useState<Invoice | null>(null);
  const [historyFor, setHistoryFor] = useState<Invoice | null>(null);

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

  const noteAllowed = (b: Invoice) =>
    b.status === 'FINALIZED' &&
    (allowCreate || allowVoid) &&
    (!b.documentType || b.documentType === 'TAX_INVOICE');

  const recordPayment = (b: Invoice) => {
    setHistoryFor(null);
    setPayingFor(b);
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
            stackOnMobile
            columns={[
              { key: 'billNo', label: 'Bill No', nowrap: true },
              { key: 'party', label: 'Party' },
              { key: 'staff', label: 'Raised by' },
              { key: 'total', label: 'Total', align: 'right', nowrap: true },
              { key: 'paid', label: 'Paid', align: 'right', nowrap: true },
              { key: 'due', label: 'Due', align: 'right', nowrap: true },
              { key: 'status', label: 'Status' },
              { key: 'actions', label: '', nowrap: true },
            ]}
            rows={bills.map((b) => ({
              id: b.id,
              cells: {
                billNo: (
                  <>
                    {b.billNo}
                    <span className="cell-sub">{formatDate(b.invoiceDate)}</span>
                    {b.documentType === 'CREDIT_NOTE' ||
                    b.documentType === 'DEBIT_NOTE' ? (
                      <span className="cell-sub">
                        {b.documentType === 'CREDIT_NOTE' ? 'Credit note' : 'Debit note'}
                      </span>
                    ) : null}
                  </>
                ),
                party: b.partyName,
                staff: (
                  <div className="actor-cell">
                    <span>
                      {actorDisplayName(b.createdBy)}{' '}
                      {actorRoleLabel(b.createdBy) ? (
                        <span
                          className={`role-badge role-${(
                            b.createdBy?.role || 'billing_operator'
                          ).toLowerCase()}`}
                        >
                          {actorRoleLabel(b.createdBy)}
                        </span>
                      ) : null}
                    </span>
                    {b.finalizedBy && b.finalizedBy.id !== b.createdBy?.id ? (
                      <span className="cell-sub">
                        Finalized by {actorDisplayName(b.finalizedBy)}
                      </span>
                    ) : null}
                    {b.status === 'VOID' ? (
                      <span
                        className="cell-sub pay-amt-due"
                        title={b.voidReason ?? undefined}
                      >
                        Voided by {actorDisplayName(b.voidedBy)}
                        {b.voidedBy?.role ? ` (${roleLabel(b.voidedBy.role)})` : ''}
                        {b.voidReason
                          ? ` · ${
                              b.voidReason.length > 24
                                ? `${b.voidReason.slice(0, 24)}…`
                                : b.voidReason
                            }`
                          : ''}
                      </span>
                    ) : null}
                  </div>
                ),
                total: formatInr(toNum(b.grandTotal)),
                paid: (
                  <>
                    {formatInr(toNum(b.amountPaid))}
                    {(b.payments?.length ?? 0) > 1 ? (
                      <span className="cell-sub">
                        {b.payments!.length} payments
                      </span>
                    ) : null}
                  </>
                ),
                due:
                  b.paymentStatus === 'PAID' && b.settledAt ? (
                    <>
                      {formatInr(0)}
                      {b.payments?.some((p) => p.stage === 'DUE_COLLECTION') ? (
                        <span className="cell-sub pay-amt-in">
                          Settled {formatDate(b.settledAt)}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {formatInr(toNum(b.balanceDue))}
                      {b.status === 'FINALIZED' &&
                      toNum(b.balanceDue) > 0.01 &&
                      b.dueDate ? (
                        <span className="cell-sub">
                          due {formatDate(b.dueDate)}
                        </span>
                      ) : null}
                    </>
                  ),
                status: (
                  <div className="status-stack">
                    <StatusBadge status={b.status} />
                    {b.status === 'FINALIZED' && b.paymentStatus ? (
                      <StatusBadge status={b.paymentStatus} />
                    ) : null}
                  </div>
                ),
                actions: (
                  <div className="inline-actions">
                    <Button
                      variant="secondary"
                      onClick={() => navigate(`/app/bills/${b.id}`)}
                    >
                      Open
                    </Button>
                    {b.status === 'FINALIZED' &&
                    allowPay &&
                    toNum(b.balanceDue) > 0.01 ? (
                      <Button onClick={() => recordPayment(b)}>
                        Receive
                      </Button>
                    ) : null}
                    <Button
                      variant="secondary"
                      onClick={() => void printBill(b.id)}
                    >
                      Print
                    </Button>
                    <ActionMenu
                      items={[
                        {
                          label: 'Payment history',
                          hidden: b.status === 'DRAFT',
                          onSelect: () => setHistoryFor(b),
                        },
                        {
                          label: 'Email invoice',
                          hidden: !(b.status === 'FINALIZED' && allowCreate),
                          onSelect: () => void shareEmail(b.id, b.billNo),
                        },
                        {
                          label: 'Send on WhatsApp',
                          hidden: !(b.status === 'FINALIZED' && allowCreate),
                          onSelect: () => void shareWhatsapp(b),
                        },
                        {
                          label: 'Create credit note',
                          hidden: !noteAllowed(b),
                          onSelect: () =>
                            navigate(`/app/notes/document?type=credit&ref=${b.id}`),
                        },
                        {
                          label: 'Create debit note',
                          hidden: !noteAllowed(b),
                          onSelect: () =>
                            navigate(`/app/notes/document?type=debit&ref=${b.id}`),
                        },
                        {
                          label: 'Void bill',
                          danger: true,
                          hidden: !(b.status === 'FINALIZED' && allowVoid),
                          onSelect: () => void voidBill(b.id, b.billNo),
                        },
                        {
                          label: 'Move to recycle bin',
                          danger: true,
                          hidden: !allowBin,
                          onSelect: () => void moveToBin(b),
                        },
                      ]}
                    />
                  </div>
                ),
              },
            }))}
          />
        )}
      </div>
      {payingFor ? (
        <ReceivePaymentDialog
          invoice={payingFor}
          onClose={() => setPayingFor(null)}
          onSaved={(updated, receipt) => {
            setPayingFor(null);
            setError(null);
            setSuccess(
              receipt.settled
                ? `${updated.billNo} settled in full — received ${formatInr(receipt.amount)}`
                : `Received ${formatInr(receipt.amount)} on ${updated.billNo} · balance due ${formatInr(updated.balanceDue)}`,
            );
            load();
          }}
        />
      ) : null}
      {historyFor ? (
        <PaymentHistoryDialog
          key={`${historyFor.id}-${historyFor.amountPaid}`}
          invoice={historyFor}
          canReceive={allowPay}
          onClose={() => setHistoryFor(null)}
          onChanged={(updated) => {
            setHistoryFor(updated);
            load();
          }}
          onReceive={(latest) => recordPayment(latest)}
        />
      ) : null}
    </>
  );
}
