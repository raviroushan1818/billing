import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { invoicesApi } from '../api';
import { useAuth } from '../auth/AuthContext';
import { actorDisplayName, canVoidBills } from '../auth/roles';
import { ActionMenu } from './ActionMenu';
import { useDialog } from './Dialog';
import { openPaymentReceipt, sendReceiptOnWhatsapp } from '../utils/paymentReceipt';
import type { Invoice, InvoicePayment, PaymentMode } from '../types';
import {
  formatDate,
  formatDateTime,
  formatInr,
  PAYMENT_MODE_LABEL,
  round2,
  toNum,
} from '../utils/format';
import { Alert, Button, Field, StatusBadge } from './ui';

function localNowInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso.slice(0, 10) + 'T00:00:00');
  const to = new Date(toIso);
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

function paymentReference(p: InvoicePayment): string {
  if (p.mode === 'UPI' && p.upiRefId) return p.upiRefId;
  if (p.mode === 'CARD' && p.cardLast4) return `•••• ${p.cardLast4}`;
  return '—';
}

function Modal({
  title,
  subtitle,
  wide,
  onClose,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`dialog-card${wide ? ' dialog-wide' : ' dialog-medium'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-dialog-title"
      >
        <div className="dialog-header dialog-header-row">
          <div>
            <h2 id="pay-dialog-title">{title}</h2>
            {subtitle ? <p className="dialog-subtitle">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="dialog-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function BillMoneySummary({ invoice }: { invoice: Invoice }) {
  const total = toNum(invoice.grandTotal);
  const paid = toNum(invoice.amountPaid);
  const due = toNum(invoice.balanceDue);
  return (
    <div className="pay-summary">
      <div>
        <span>Bill total</span>
        <strong>{formatInr(total)}</strong>
      </div>
      <div>
        <span>Paid so far</span>
        <strong className="pay-amt-in">{formatInr(paid)}</strong>
      </div>
      <div>
        <span>Balance due</span>
        <strong className={due > 0.01 ? 'pay-amt-due' : 'pay-amt-in'}>
          {formatInr(due)}
        </strong>
      </div>
    </div>
  );
}

/** Full form to receive money against a finalized bill's balance due. */
export function ReceivePaymentDialog({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: Invoice;
  onClose: () => void;
  onSaved: (updated: Invoice, receipt: { amount: number; settled: boolean }) => void;
}) {
  const due = round2(toNum(invoice.balanceDue));
  const [amount, setAmount] = useState<string>(due.toFixed(2));
  const [mode, setMode] = useState<PaymentMode>('CASH');
  const [upiRefId, setUpiRefId] = useState('');
  const [cardLast4, setCardLast4] = useState('');
  const [receivedAt, setReceivedAt] = useState(localNowInput());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{
    invoice: Invoice;
    payment: InvoicePayment | null;
  } | null>(null);

  const amt = round2(Number(amount) || 0);
  const after = round2(Math.max(0, due - amt));
  const invoiceDay = invoice.invoiceDate.slice(0, 10);

  const validate = (): string | null => {
    if (!(amt > 0)) return 'Enter the amount received.';
    if (amt > due + 0.01) {
      return `Amount cannot exceed the balance due of ${formatInr(due)}.`;
    }
    if (mode === 'UPI' && !upiRefId.trim()) {
      return 'Enter the UPI transaction / reference ID.';
    }
    if (mode === 'CARD' && !/^\d{4}$/.test(cardLast4)) {
      return 'Enter the last 4 digits of the card.';
    }
    if (!receivedAt) return 'Enter when the payment was received.';
    const when = new Date(receivedAt);
    if (when.getTime() > Date.now() + 60_000) {
      return 'Payment date cannot be in the future.';
    }
    if (receivedAt.slice(0, 10) < invoiceDay) {
      return 'Payment date cannot be before the bill date.';
    }
    return null;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await invoicesApi.addPayment(invoice.id, {
        mode,
        amount: amt,
        upiRefId: mode === 'UPI' ? upiRefId.trim() : undefined,
        cardLast4: mode === 'CARD' ? cardLast4 : undefined,
        notes: notes.trim() || undefined,
        paidAt: new Date(receivedAt).toISOString(),
      });
      const before = new Set((invoice.payments ?? []).map((p) => p.id));
      const payment =
        (updated.payments ?? []).find((p) => p.id && !before.has(p.id)) ?? null;
      setSaved({ invoice: updated, payment });
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record payment');
      setBusy(false);
    }
  };

  if (saved) {
    const settled = toNum(saved.invoice.balanceDue) <= 0.01;
    const finish = () => onSaved(saved.invoice, { amount: amt, settled });
    return (
      <Modal
        title={settled ? 'Bill settled' : 'Payment recorded'}
        subtitle={
          <>
            {saved.invoice.billNo} · {saved.invoice.partyName}
          </>
        }
        onClose={finish}
      >
        <div className={`pay-outcome${settled ? ' pay-outcome-settled' : ''}`}>
          Received <strong>{formatInr(amt)}</strong>
          {saved.payment?.receiptNo ? (
            <>
              {' '}
              · receipt <span className="mono">{saved.payment.receiptNo}</span>
            </>
          ) : null}
          <br />
          {settled ? (
            <>The bill is now fully settled.</>
          ) : (
            <>
              Balance still due: <strong>{formatInr(saved.invoice.balanceDue)}</strong>
            </>
          )}
        </div>
        <div className="dialog-actions">
          {saved.payment ? (
            <>
              <Button
                variant="secondary"
                onClick={() =>
                  void openPaymentReceipt(saved.invoice, saved.payment!).catch((e) =>
                    setError(e instanceof Error ? e.message : 'Could not open receipt'),
                  )
                }
              >
                Print receipt
              </Button>
              <Button
                variant="secondary"
                onClick={() => void sendReceiptOnWhatsapp(saved.invoice, saved.payment!)}
              >
                WhatsApp receipt
              </Button>
            </>
          ) : null}
          <Button onClick={finish}>Done</Button>
        </div>
        {error ? <p className="dialog-error">{error}</p> : null}
      </Modal>
    );
  }

  return (
    <Modal
      title="Receive payment"
      subtitle={
        <>
          {invoice.billNo} · {invoice.partyName} · billed{' '}
          {formatDate(invoice.invoiceDate)}
        </>
      }
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={(e) => void submit(e)} className="pay-form">
        <BillMoneySummary invoice={invoice} />

        <Field label="Amount received (₹)" htmlFor="pay-amount">
          <div className="pay-amount-row">
            <input
              id="pay-amount"
              type="number"
              inputMode="decimal"
              min={0.01}
              step="0.01"
              max={due}
              value={amount}
              autoFocus
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
            />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setAmount(due.toFixed(2))}
            >
              Full balance
            </button>
          </div>
        </Field>

        <div className="field">
          <span className="field-label">Payment mode</span>
          <div className="seg" role="radiogroup" aria-label="Payment mode">
            {(['CASH', 'UPI', 'CARD'] as PaymentMode[]).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                className={mode === m ? 'seg-on' : undefined}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
              >
                {PAYMENT_MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>

        {mode === 'UPI' ? (
          <Field label="UPI transaction / ref ID" htmlFor="pay-upi">
            <input
              id="pay-upi"
              value={upiRefId}
              placeholder="e.g. 428193746512"
              onChange={(e) => setUpiRefId(e.target.value)}
            />
          </Field>
        ) : null}
        {mode === 'CARD' ? (
          <Field label="Card last 4 digits" htmlFor="pay-card">
            <input
              id="pay-card"
              inputMode="numeric"
              maxLength={4}
              value={cardLast4}
              onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
        ) : null}

        <Field
          label="Received on"
          htmlFor="pay-when"
          hint="Change this if the money was received earlier and is being entered now."
        >
          <input
            id="pay-when"
            type="datetime-local"
            value={receivedAt}
            min={`${invoiceDay}T00:00`}
            max={localNowInput()}
            onChange={(e) => setReceivedAt(e.target.value)}
          />
        </Field>

        <Field label="Note (optional)" htmlFor="pay-notes">
          <input
            id="pay-notes"
            maxLength={500}
            value={notes}
            placeholder="e.g. Paid by son, 2nd instalment"
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        <div className={`pay-outcome${after <= 0.01 && amt > 0 ? ' pay-outcome-settled' : ''}`}>
          {amt > due + 0.01 ? (
            <>Amount is more than the balance due.</>
          ) : after <= 0.01 && amt > 0 ? (
            <>
              This payment <strong>settles the bill in full</strong>.
            </>
          ) : (
            <>
              Balance after this payment: <strong>{formatInr(after)}</strong>
            </>
          )}
        </div>

        {error ? <p className="dialog-error">{error}</p> : null}

        <div className="dialog-actions">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : `Record ${formatInr(amt)}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Chronological ledger of every payment taken on a bill. */
export function PaymentLedger({
  invoice,
  onChanged,
}: {
  invoice: Invoice;
  /** Called with the updated bill after a payment is reversed. */
  onChanged?: (updated: Invoice) => void;
}) {
  const { user } = useAuth();
  const dialog = useDialog();
  const [error, setError] = useState<string | null>(null);
  const canReverse =
    !!onChanged && invoice.status === 'FINALIZED' && canVoidBills(user?.role ?? '');

  const payments = [...(invoice.payments ?? [])].sort((a, b) =>
    (a.paidAt ?? '').localeCompare(b.paidAt ?? ''),
  );
  const live = payments.filter((p) => !p.reversedAt);
  const total = toNum(invoice.grandTotal);
  const settled = invoice.paymentStatus === 'PAID' && total > 0;
  const collectedLater = live.some((p) => p.stage === 'DUE_COLLECTION');

  let running = total;
  const rows = payments.map((p) => {
    if (p.reversedAt) return { p, balanceAfter: null as number | null };
    running = round2(running - toNum(p.amount));
    const balanceAfter =
      p.balanceAfter != null ? toNum(p.balanceAfter) : Math.max(0, running);
    return { p, balanceAfter };
  });

  const reverse = async (p: InvoicePayment) => {
    if (!p.id) return;
    const reason = await dialog.prompt({
      title: `Reverse ${p.receiptNo ?? 'payment'}`,
      message: `Reverse ${formatInr(p.amount)} (${PAYMENT_MODE_LABEL[p.mode] ?? p.mode}) received ${formatDateTime(p.paidAt)}? The entry stays on record marked as reversed, and the amount is added back to the balance due.`,
      label: 'Reason',
      placeholder: 'e.g. Entered wrong amount / wrong mode / cheque bounced',
      confirmLabel: 'Reverse payment',
      required: true,
      multiline: true,
      danger: true,
    });
    if (reason === null) return;
    if (reason.trim().length < 3) {
      setError('Give a reason of at least 3 characters.');
      return;
    }
    try {
      setError(null);
      const updated = await invoicesApi.reversePayment(invoice.id, p.id, reason.trim());
      onChanged?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reverse payment');
    }
  };

  const printReceipt = (p: InvoicePayment) =>
    void openPaymentReceipt(invoice, p).catch((e) =>
      setError(e instanceof Error ? e.message : 'Could not open receipt'),
    );

  return (
    <div className="pay-ledger">
      {error ? <Alert>{error}</Alert> : null}
      {settled && invoice.settledAt ? (
        <div className="pay-settled-banner">
          <StatusBadge status="PAID" />
          <span>
            Settled in full on <strong>{formatDateTime(invoice.settledAt)}</strong>
            {collectedLater
              ? ` · ${daysBetween(invoice.invoiceDate, invoice.settledAt)} day(s) after billing`
              : ' · paid at billing'}
          </span>
        </div>
      ) : toNum(invoice.balanceDue) > 0.01 && invoice.status === 'FINALIZED' ? (
        <div className="pay-due-banner">
          <StatusBadge status={invoice.paymentStatus ?? 'UNPAID'} />
          <span>
            <strong>{formatInr(invoice.balanceDue)}</strong> outstanding
            {invoice.dueDate ? ` · due ${formatDate(invoice.dueDate)}` : ''}
          </span>
        </div>
      ) : null}

      {rows.length ? (
        <div className="table-wrap">
          <table className="data-table pay-ledger-table">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Received on</th>
                <th>Type</th>
                <th>Mode</th>
                <th className="num">Amount</th>
                <th className="num">Balance after</th>
                <th>Received by</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, balanceAfter }, i) => (
                <tr key={p.id ?? i} className={p.reversedAt ? 'pay-row-reversed' : undefined}>
                  <td className="mono" title={p.receiptNo ?? undefined}>
                    {p.receiptNo?.split('/').pop() ?? `#${i + 1}`}
                  </td>
                  <td>
                    {formatDateTime(p.paidAt)}
                    {p.notes ? <div className="muted small">{p.notes}</div> : null}
                    {p.reversedAt ? (
                      <div className="pay-reversal-note">
                        Reversed {formatDateTime(p.reversedAt)} by{' '}
                        {actorDisplayName(p.reversedBy)}
                        {p.reversalReason ? ` — ${p.reversalReason}` : ''}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    {p.reversedAt ? (
                      <span className="badge badge-danger">Reversed</span>
                    ) : (
                      <span
                        className={`badge ${
                          p.stage === 'DUE_COLLECTION' ? 'badge-info' : 'badge-muted'
                        }`}
                      >
                        {p.stage === 'DUE_COLLECTION' ? 'Due collection' : 'At billing'}
                      </span>
                    )}
                  </td>
                  <td>
                    {PAYMENT_MODE_LABEL[p.mode] ?? p.mode}
                    {paymentReference(p) !== '—' ? (
                      <div className="muted small mono">{paymentReference(p)}</div>
                    ) : null}
                  </td>
                  <td className="num">
                    <span className={p.reversedAt ? 'pay-amt-struck' : 'pay-amt-in'}>
                      {formatInr(p.amount)}
                    </span>
                  </td>
                  <td className="num">
                    {balanceAfter == null ? (
                      '—'
                    ) : balanceAfter <= 0.01 ? (
                      <span className="pay-amt-in">Settled</span>
                    ) : (
                      formatInr(balanceAfter)
                    )}
                  </td>
                  <td>{actorDisplayName(p.receivedBy)}</td>
                  <td>
                    <ActionMenu
                      label="Receipt"
                      items={[
                        { label: 'Print receipt', onSelect: () => printReceipt(p) },
                        {
                          label: 'Send on WhatsApp',
                          hidden: !!p.reversedAt,
                          onSelect: () => void sendReceiptOnWhatsapp(invoice, p),
                        },
                        {
                          label: 'Reverse payment',
                          danger: true,
                          hidden: !canReverse || !!p.reversedAt,
                          onSelect: () => void reverse(p),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>
                  {live.length} payment{live.length === 1 ? '' : 's'}
                  {payments.length > live.length
                    ? ` (+${payments.length - live.length} reversed)`
                    : ''}{' '}
                  · bill total {formatInr(total)}
                </td>
                <td className="num">{formatInr(invoice.amountPaid)}</td>
                <td className="num">{formatInr(invoice.balanceDue)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="empty-state">No payments received on this bill yet.</p>
      )}
    </div>
  );
}

/** Modal showing a bill's payment ledger, with a shortcut to receive more. */
export function PaymentHistoryDialog({
  invoice,
  canReceive,
  onClose,
  onReceive,
  onChanged,
}: {
  invoice: Invoice;
  canReceive: boolean;
  onClose: () => void;
  onReceive: (latest: Invoice) => void;
  /** Called after a payment on this bill is reversed. */
  onChanged?: (updated: Invoice) => void;
}) {
  const [fresh, setFresh] = useState<Invoice>(invoice);
  useEffect(() => {
    void invoicesApi.get(invoice.id).then(setFresh).catch(() => undefined);
  }, [invoice.id]);

  const open =
    fresh.status === 'FINALIZED' && toNum(fresh.balanceDue) > 0.01;
  return (
    <Modal
      wide
      title={`Payment history · ${fresh.billNo}`}
      subtitle={
        <>
          {fresh.partyName}
          {fresh.partyPhone ? ` · ${fresh.partyPhone}` : ''} · billed{' '}
          {formatDate(fresh.invoiceDate)}
        </>
      }
      onClose={onClose}
    >
      <BillMoneySummary invoice={fresh} />
      <PaymentLedger
        invoice={fresh}
        onChanged={(updated) => {
          setFresh(updated);
          onChanged?.(updated);
        }}
      />
      <div className="dialog-actions">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        {open && canReceive ? (
          <Button onClick={() => onReceive(fresh)}>Receive payment</Button>
        ) : null}
      </div>
    </Modal>
  );
}
