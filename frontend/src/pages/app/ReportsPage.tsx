import { useCallback, useEffect, useState } from 'react';
import { invoicesApi, reportsApi } from '../../api';
import type {
  CollectionsReport,
  DayBookReport,
  DueSettlementsReport,
  Invoice,
  PrintFormat,
} from '../../types';
import {
  formatDate,
  formatDateTime,
  formatInr,
  PAYMENT_MODE_LABEL,
  formatPayments,
  shiftDaysIso,
  startOfMonthIso,
  todayIso,
  toNum,
} from '../../utils/format';
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
import { BarChart3 } from 'lucide-react';
import { ActionMenu } from '../../components/ActionMenu';
import {
  csvDueCollections,
  csvOutstanding,
  csvSettled,
  exportDailySummary,
  exportDueCollections,
  exportOutstanding,
  exportSettled,
  exportDayBook,
  exportHsnSummary,
  exportItc,
  exportPaymentRegister,
} from '../../utils/reportExports';
import {
  PaymentHistoryDialog,
  ReceivePaymentDialog,
} from '../../components/payments';
import { useAuth } from '../../auth/AuthContext';

type DueTab = 'outstanding' | 'collections' | 'settled';

function emptyCollections(): CollectionsReport {
  return { cash: 0, upi: 0, card: 0, total: 0, paymentCount: 0 };
}

export function ReportsPage() {
  const { user } = useAuth();
  const dialog = useDialog();
  const canExportGstr1 =
    user?.role === 'CLIENT_ADMIN' || user?.role === 'ACCOUNTANT';

  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [dayBook, setDayBook] = useState<DayBookReport | null>(null);
  const [collections, setCollections] = useState<CollectionsReport | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [receivables, setReceivables] = useState<Awaited<
    ReturnType<typeof reportsApi.receivables>
  > | null>(null);
  const [dues, setDues] = useState<DueSettlementsReport | null>(null);
  const [dueTab, setDueTab] = useState<DueTab>('outstanding');
  const [dueSearch, setDueSearch] = useState('');
  const [payingFor, setPayingFor] = useState<Invoice | null>(null);
  const [historyFor, setHistoryFor] = useState<Invoice | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canReceive =
    user?.role === 'CLIENT_ADMIN' ||
    user?.role === 'BILLING_OPERATOR' ||
    user?.role === 'ACCOUNTANT';
  const [itc, setItc] = useState<Awaited<
    ReturnType<typeof reportsApi.itc>
  > | null>(null);

  const load = useCallback(async (rangeFrom = from, rangeTo = to) => {
    setLoading(true);
    setError(null);
    try {
      const [book, coll, recv, itcRep, dueRep] = await Promise.all([
        reportsApi.dayBook(rangeFrom, rangeTo),
        reportsApi.collections(rangeFrom, rangeTo),
        reportsApi.receivables().catch(() => null),
        reportsApi.itc(rangeFrom, rangeTo).catch(() => null),
        reportsApi.dueSettlements(rangeFrom, rangeTo).catch(() => null),
      ]);
      setDayBook(book);
      setCollections(coll);
      setReceivables(recv);
      setDues(dueRep);
      setItc(itcRep);
    } catch (e) {
      setDayBook(null);
      setCollections(null);
      setError(e instanceof Error ? e.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, []);

  const applyPreset = (preset: 'today' | '7d' | 'month') => {
    const end = todayIso();
    let start = end;
    if (preset === '7d') start = shiftDaysIso(end, -6);
    if (preset === 'month') start = startOfMonthIso(end);
    setFrom(start);
    setTo(end);
    void load(start, end);
  };

  /** Runs one export for the chosen From/To range. */
  const runExport = async (fn: (from: string, to: string) => Promise<unknown>) => {
    if (!from || !to || from > to) {
      setError('Choose a valid From and To date before exporting.');
      return;
    }
    setExportBusy(true);
    setError(null);
    try {
      await fn(from, to);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExportBusy(false);
    }
  };

  const printBill = async (id: string) => {
    const format = await dialog.prompt({
      title: 'Print bill',
      message: 'Choose paper format for this print.',
      label: 'Print format',
      defaultValue: 'A4',
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

  const openBill = async (id: string, then: 'pay' | 'history') => {
    try {
      setError(null);
      const inv = await invoicesApi.get(id);
      if (then === 'pay') setPayingFor(inv);
      else setHistoryFor(inv);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open bill');
    }
  };

  const needle = dueSearch.trim().toLowerCase();
  const matches = (...fields: Array<string | null | undefined>) =>
    !needle || fields.some((f) => f?.toLowerCase().includes(needle));
  const outstandingRows = (receivables?.rows ?? []).filter((r) =>
    matches(r.billNo, r.partyName, r.partyPhone),
  );
  const collectionRows = (dues?.collections ?? []).filter((r) =>
    matches(r.billNo, r.partyName, r.partyPhone, r.receiptNo, r.reference),
  );
  const settledRows = (dues?.settled ?? []).filter((r) =>
    matches(r.billNo, r.partyName, r.partyPhone),
  );

  /** Exports the dues tab currently on screen (respects the search box). */
  const exportDues = () => {
    if (dueTab === 'outstanding') csvOutstanding(outstandingRows);
    else if (dueTab === 'collections') csvDueCollections(collectionRows, from, to);
    else csvSettled(settledRows, from, to);
  };

  const totals = dayBook?.totals;
  const coll = collections ?? emptyCollections();
  const entries = dayBook?.entries ?? [];

  return (
    <>
      <PageHeader
        icon={<BarChart3 size={22} />}
        title="Reports"
        subtitle="Day book, collections, dues & settlements, GST summary & GSTR-1 export"
      />

      {error ? <Alert>{error}</Alert> : null}

      <div className="panel">
        <div className="filter-bar">
          <Field label="From" htmlFor="r-from">
            <input
              id="r-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="To" htmlFor="r-to">
            <input
              id="r-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <Button onClick={() => void load()} disabled={loading}>
            {loading ? 'Loading…' : 'Apply'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => applyPreset('today')}
            disabled={loading}
          >
            Today
          </Button>
          <Button
            variant="secondary"
            onClick={() => applyPreset('7d')}
            disabled={loading}
          >
            Last 7 days
          </Button>
          <Button
            variant="secondary"
            onClick={() => applyPreset('month')}
            disabled={loading}
          >
            This month
          </Button>
          <ActionMenu
            label={exportBusy ? 'Exporting…' : 'Export CSV'}
            items={[
              {
                label: 'Daily summary (sales, GST, collections)',
                onSelect: () => void runExport(exportDailySummary),
              },
              {
                label: 'Day book — bill-wise',
                onSelect: () => void runExport(exportDayBook),
              },
              {
                label: 'Payment register — all receipts',
                onSelect: () => void runExport(exportPaymentRegister),
              },
              {
                label: 'HSN / GST rate summary',
                hidden: !canExportGstr1 && user?.role !== 'VIEWER',
                onSelect: () => void runExport(exportHsnSummary),
              },
              {
                label: 'Outstanding dues',
                onSelect: () => void runExport(exportOutstanding),
              },
              {
                label: 'Due collections',
                onSelect: () => void runExport(exportDueCollections),
              },
              {
                label: 'Settled bills',
                onSelect: () => void runExport(exportSettled),
              },
              {
                label: 'Purchase ITC',
                hidden: !canExportGstr1 && user?.role !== 'VIEWER',
                onSelect: () => void runExport(exportItc),
              },
              {
                label: 'GSTR-1 JSON (for GST portal)',
                hidden: !canExportGstr1,
                onSelect: () => void runExport((f, t) => reportsApi.gstr1(f, t)),
              },
            ]}
          />
        </div>

        <h2 className="panel-title">Collections by mode</h2>
        <div className="stat-row">
          <div className="stat">
            <div className="stat-label">Cash</div>
            <div className="stat-value">{formatInr(toNum(coll.cash))}</div>
          </div>
          <div className="stat">
            <div className="stat-label">UPI</div>
            <div className="stat-value">{formatInr(toNum(coll.upi))}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Card</div>
            <div className="stat-value">{formatInr(toNum(coll.card))}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Total collected</div>
            <div className="stat-value">{formatInr(toNum(coll.total))}</div>
          </div>
        </div>

        <h2 className="panel-title">GST summary</h2>
        <div className="stat-row">
          <div className="stat">
            <div className="stat-label">Bills</div>
            <div className="stat-value">{totals?.invoiceCount ?? 0}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Taxable</div>
            <div className="stat-value">
              {formatInr(totals?.taxable ?? 0)}
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">CGST</div>
            <div className="stat-value">{formatInr(totals?.cgst ?? 0)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">SGST</div>
            <div className="stat-value">{formatInr(totals?.sgst ?? 0)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">IGST</div>
            <div className="stat-value">{formatInr(totals?.igst ?? 0)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Invoice total</div>
            <div className="stat-value">{formatInr(totals?.grand ?? 0)}</div>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">
          Day book
          {from && to ? (
            <span className="panel-title-meta">
              {' '}
              · {from} → {to}
            </span>
          ) : null}
        </h2>
        {loading && !dayBook ? (
          <p className="muted">Loading…</p>
        ) : (
          <DataTable
            columns={[
              { key: 'date', label: 'Date' },
              { key: 'billNo', label: 'Bill No' },
              { key: 'party', label: 'Party' },
              { key: 'taxable', label: 'Taxable', align: 'right' },
              { key: 'gst', label: 'GST', align: 'right' },
              { key: 'total', label: 'Total', align: 'right' },
              { key: 'payments', label: 'Payments' },
              { key: 'status', label: 'Status' },
            ]}
            rows={entries.map((e, i) => {
              const gst =
                toNum(e.cgstAmount) + toNum(e.sgstAmount) + toNum(e.igstAmount);
              return {
                id: `${e.billNo}-${i}`,
                cells: {
                  date: e.date.slice(0, 10),
                  billNo: e.billNo,
                  party: e.partyName,
                  taxable: formatInr(toNum(e.taxableAmount)),
                  gst: formatInr(gst),
                  total: formatInr(toNum(e.grandTotal)),
                  payments: formatPayments(e.payments),
                  status: <StatusBadge status={e.status} />,
                },
              };
            })}
            emptyText="No finalized bills in this period."
          />
        )}
      </div>

      <div className="panel">
        <div className="panel-title-row">
          <h2 className="panel-title">
            Dues &amp; settlements
            <span className="panel-title-meta">
              {' '}
              · {from} → {to}
            </span>
          </h2>
          <div className="inline-actions">
            <input
              aria-label="Search dues"
              placeholder="Search bill, party, phone, receipt…"
              value={dueSearch}
              onChange={(e) => setDueSearch(e.target.value)}
            />
            <Button variant="secondary" onClick={() => exportDues()}>
              Export CSV
            </Button>
          </div>
        </div>
        {notice ? <Alert variant="success">{notice}</Alert> : null}

        <div className="stat-row" style={{ marginTop: '1rem' }}>
          <div className="stat">
            <div className="stat-label">Outstanding now</div>
            <div className="stat-value pay-amt-due">
              {formatInr(receivables?.summary.totalDue ?? 0)}
            </div>
            <div className="stat-hint">
              {receivables?.summary.count ?? 0} open bill(s), all dates
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">Credit given in period</div>
            <div className="stat-value">
              {formatInr(dues?.summary.creditGiven ?? 0)}
            </div>
            <div className="stat-hint">Left unpaid at billing</div>
          </div>
          <div className="stat">
            <div className="stat-label">Dues recovered in period</div>
            <div className="stat-value pay-amt-in">
              {formatInr(dues?.summary.recovered ?? 0)}
            </div>
            <div className="stat-hint">
              {dues?.summary.collectionCount ?? 0} payment(s) · Cash{' '}
              {formatInr(dues?.summary.recoveredByMode.CASH ?? 0)} · UPI{' '}
              {formatInr(dues?.summary.recoveredByMode.UPI ?? 0)} · Card{' '}
              {formatInr(dues?.summary.recoveredByMode.CARD ?? 0)}
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">Bills settled in period</div>
            <div className="stat-value">{dues?.summary.settledCount ?? 0}</div>
            <div className="stat-hint">Balance cleared to zero</div>
          </div>
        </div>

        {receivables ? (
          <p className="muted">
            Ageing — Not yet due {formatInr(receivables.summary.byBucket.current ?? 0)} ·
            1–30 days {formatInr(receivables.summary.byBucket['1-30'] ?? 0)} · 31–60{' '}
            {formatInr(receivables.summary.byBucket['31-60'] ?? 0)} · 61–90{' '}
            {formatInr(receivables.summary.byBucket['61-90'] ?? 0)} · 90+{' '}
            {formatInr(receivables.summary.byBucket['90+'] ?? 0)}
          </p>
        ) : null}

        <div className="report-tabs" role="tablist">
          {(
            [
              ['outstanding', 'Outstanding', outstandingRows.length],
              ['collections', 'Due collections', collectionRows.length],
              ['settled', 'Settled bills', settledRows.length],
            ] as Array<[DueTab, string, number]>
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={dueTab === key}
              className={dueTab === key ? 'active' : undefined}
              onClick={() => setDueTab(key)}
            >
              {label}
              <span className="tab-count">{count}</span>
            </button>
          ))}
        </div>

        {dueTab === 'outstanding' ? (
          <DataTable
            stackOnMobile
            columns={[
              { key: 'billNo', label: 'Bill', nowrap: true },
              { key: 'party', label: 'Party' },
              { key: 'total', label: 'Bill total', align: 'right' },
              { key: 'paid', label: 'Paid', align: 'right' },
              { key: 'balance', label: 'Balance due', align: 'right' },
              { key: 'due', label: 'Due date' },
              { key: 'last', label: 'Last payment' },
              { key: 'status', label: 'Status' },
              { key: 'actions', label: '', nowrap: true },
            ]}
            rows={outstandingRows.map((r) => ({
              id: r.id,
              cells: {
                billNo: (
                  <>
                    {r.billNo}
                    <span className="cell-sub">billed {formatDate(r.invoiceDate)}</span>
                  </>
                ),
                party: (
                  <>
                    {r.partyName}
                    {r.partyPhone ? <span className="cell-sub">{r.partyPhone}</span> : null}
                  </>
                ),
                total: formatInr(r.grandTotal),
                paid: formatInr(r.amountPaid),
                balance: <strong className="pay-amt-due">{formatInr(r.balanceDue)}</strong>,
                due: (
                  <>
                    {formatDate(r.dueDate)}
                    <span className={`cell-sub${r.daysPastDue > 0 ? ' pay-amt-due' : ''}`}>
                      {r.daysPastDue > 0 ? `${r.daysPastDue} day(s) overdue` : 'not yet due'}
                    </span>
                  </>
                ),
                last: r.lastPaymentAt ? (
                  <>
                    {formatInr(r.lastPaymentAmount)}{' '}
                    {r.lastPaymentMode ? PAYMENT_MODE_LABEL[r.lastPaymentMode] : ''}
                    <span className="cell-sub">{formatDateTime(r.lastPaymentAt)}</span>
                  </>
                ) : (
                  <span className="muted">No payment yet</span>
                ),
                status: <StatusBadge status={r.paymentStatus} />,
                actions: (
                  <div className="inline-actions">
                    {canReceive ? (
                      <Button onClick={() => void openBill(r.id, 'pay')}>
                        Receive
                      </Button>
                    ) : null}
                    <Button variant="secondary" onClick={() => void openBill(r.id, 'history')}>
                      History
                    </Button>
                    <Button variant="secondary" onClick={() => void printBill(r.id)}>
                      Print
                    </Button>
                  </div>
                ),
              },
            }))}
            emptyText="No outstanding balances. All bills are settled."
          />
        ) : null}

        {dueTab === 'collections' ? (
          <DataTable
            stackOnMobile
            columns={[
              { key: 'receipt', label: 'Receipt', nowrap: true },
              { key: 'when', label: 'Received on', nowrap: true },
              { key: 'bill', label: 'Bill', nowrap: true },
              { key: 'party', label: 'Party' },
              { key: 'mode', label: 'Mode' },
              { key: 'before', label: 'Balance before', align: 'right' },
              { key: 'amount', label: 'Received', align: 'right' },
              { key: 'after', label: 'Balance after', align: 'right' },
              { key: 'by', label: 'Received by' },
              { key: 'actions', label: '', nowrap: true },
            ]}
            rows={collectionRows.map((r) => ({
              id: r.id,
              cells: {
                receipt: <span className="mono">{r.receiptNo ?? '—'}</span>,
                when: (
                  <>
                    {formatDateTime(r.paidAt)}
                    {r.notes ? <span className="cell-sub">{r.notes}</span> : null}
                  </>
                ),
                bill: (
                  <>
                    {r.billNo}
                    <span className="cell-sub">
                      billed {formatDate(r.invoiceDate)} · +{r.daysAfterBill}d
                    </span>
                  </>
                ),
                party: (
                  <>
                    {r.partyName}
                    {r.partyPhone ? <span className="cell-sub">{r.partyPhone}</span> : null}
                  </>
                ),
                mode: (
                  <>
                    {PAYMENT_MODE_LABEL[r.mode] ?? r.mode}
                    {r.reference ? <span className="cell-sub mono">{r.reference}</span> : null}
                  </>
                ),
                before: r.balanceBefore != null ? formatInr(r.balanceBefore) : '—',
                amount: <strong className="pay-amt-in">{formatInr(r.amount)}</strong>,
                after: r.settled ? (
                  <StatusBadge status="PAID" />
                ) : r.balanceAfter != null ? (
                  formatInr(r.balanceAfter)
                ) : (
                  '—'
                ),
                by: r.receivedBy ?? '—',
                actions: (
                  <Button variant="secondary" onClick={() => void openBill(r.invoiceId, 'history')}>
                    History
                  </Button>
                ),
              },
            }))}
            emptyText="No payments were collected against dues in this period."
          />
        ) : null}

        {dueTab === 'settled' ? (
          <DataTable
            stackOnMobile
            columns={[
              { key: 'bill', label: 'Bill', nowrap: true },
              { key: 'party', label: 'Party' },
              { key: 'total', label: 'Bill total', align: 'right' },
              { key: 'atBilling', label: 'Paid at billing', align: 'right' },
              { key: 'later', label: 'Collected later', align: 'right' },
              { key: 'settled', label: 'Settled on' },
              { key: 'actions', label: '', nowrap: true },
            ]}
            rows={settledRows.map((r) => ({
              id: r.id,
              cells: {
                bill: (
                  <>
                    {r.billNo}
                    <span className="cell-sub">billed {formatDate(r.invoiceDate)}</span>
                  </>
                ),
                party: (
                  <>
                    {r.partyName}
                    {r.partyPhone ? <span className="cell-sub">{r.partyPhone}</span> : null}
                  </>
                ),
                total: formatInr(r.grandTotal),
                atBilling: formatInr(r.paidAtBilling),
                later: (
                  <>
                    {formatInr(r.collectedLater)}
                    <span className="cell-sub">
                      {r.installments} instalment{r.installments === 1 ? '' : 's'}
                    </span>
                  </>
                ),
                settled: (
                  <>
                    {formatDateTime(r.settledAt)}
                    <span className="cell-sub pay-amt-in">
                      {r.daysToSettle} day(s) after billing
                    </span>
                  </>
                ),
                actions: (
                  <Button variant="secondary" onClick={() => void openBill(r.id, 'history')}>
                    History
                  </Button>
                ),
              },
            }))}
            emptyText="No credit bills were fully settled in this period."
          />
        ) : null}
      </div>

      {itc ? (
        <div className="panel">
          <h2 className="panel-title">
            Purchase ITC
            <span className="panel-title-meta">
              {' '}
              · {itc.summary.eligibleCount}/{itc.summary.purchaseCount} eligible ·{' '}
              {formatInr(itc.summary.itcTotal)} credit
            </span>
          </h2>
          <div className="stat-row">
            <div className="stat">
              <div className="stat-label">ITC CGST</div>
              <div className="stat-value">{formatInr(itc.summary.itcCgst)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">ITC SGST</div>
              <div className="stat-value">{formatInr(itc.summary.itcSgst)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">ITC IGST</div>
              <div className="stat-value">{formatInr(itc.summary.itcIgst)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Total ITC</div>
              <div className="stat-value">{formatInr(itc.summary.itcTotal)}</div>
            </div>
          </div>
          <DataTable
            columns={[
              { key: 'billNo', label: 'Purchase #' },
              { key: 'date', label: 'Date' },
              { key: 'vendor', label: 'Vendor' },
              { key: 'gstin', label: 'GSTIN' },
              { key: 'eligible', label: 'Eligible' },
              { key: 'itc', label: 'ITC', align: 'right' },
            ]}
            rows={itc.rows.map((r) => ({
              id: r.id,
              cells: {
                billNo: r.billNo,
                date: r.billDate,
                vendor: r.vendorName,
                gstin: r.vendorGstin ?? '—',
                eligible: r.itcEligible ? 'Yes' : 'No',
                itc: formatInr(r.itcTotal),
              },
            }))}
            emptyText="No purchases in this period."
          />
        </div>
      ) : null}
      {payingFor ? (
        <ReceivePaymentDialog
          invoice={payingFor}
          onClose={() => setPayingFor(null)}
          onSaved={(updated, receipt) => {
            setPayingFor(null);
            setNotice(
              receipt.settled
                ? `${updated.billNo} settled in full — received ${formatInr(receipt.amount)}`
                : `Received ${formatInr(receipt.amount)} on ${updated.billNo} · balance due ${formatInr(updated.balanceDue)}`,
            );
            void load();
          }}
        />
      ) : null}
      {historyFor ? (
        <PaymentHistoryDialog
          key={`${historyFor.id}-${historyFor.amountPaid}`}
          invoice={historyFor}
          canReceive={canReceive}
          onClose={() => setHistoryFor(null)}
          onChanged={(updated) => {
            setHistoryFor(updated);
            void load();
          }}
          onReceive={(latest) => {
            setHistoryFor(null);
            setPayingFor(latest);
          }}
        />
      ) : null}
    </>
  );
}
