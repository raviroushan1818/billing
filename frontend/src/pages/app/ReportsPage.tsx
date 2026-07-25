import { useCallback, useEffect, useState } from 'react';
import { reportsApi } from '../../api';
import type { CollectionsReport, DayBookReport } from '../../types';
import {
  formatInr,
  formatPayments,
  shiftDaysIso,
  startOfMonthIso,
  todayIso,
  toNum,
} from '../../utils/format';
import {
  Alert,
  Button,
  DataTable,
  Field,
  PageHeader,
  StatusBadge,
} from '../../components/ui';
import { BarChart3 } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

function emptyCollections(): CollectionsReport {
  return { cash: 0, upi: 0, card: 0, total: 0, paymentCount: 0 };
}

export function ReportsPage() {
  const { user } = useAuth();
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
  const [itc, setItc] = useState<Awaited<
    ReturnType<typeof reportsApi.itc>
  > | null>(null);

  const load = useCallback(async (rangeFrom = from, rangeTo = to) => {
    setLoading(true);
    setError(null);
    try {
      const [book, coll, recv, itcRep] = await Promise.all([
        reportsApi.dayBook(rangeFrom, rangeTo),
        reportsApi.collections(rangeFrom, rangeTo),
        reportsApi.receivables().catch(() => null),
        reportsApi.itc(rangeFrom, rangeTo).catch(() => null),
      ]);
      setDayBook(book);
      setCollections(coll);
      setReceivables(recv);
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

  const exportGstr1 = async () => {
    setExportBusy(true);
    setError(null);
    try {
      await reportsApi.gstr1(from, to);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExportBusy(false);
    }
  };

  const totals = dayBook?.totals;
  const coll = collections ?? emptyCollections();
  const entries = dayBook?.entries ?? [];

  return (
    <>
      <PageHeader
        icon={<BarChart3 size={22} />}
        title="Reports"
        subtitle="Day book, collections, GST summary & GSTR-1 export"
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
          {canExportGstr1 ? (
            <Button
              variant="secondary"
              onClick={() => void exportGstr1()}
              disabled={exportBusy || loading}
            >
              {exportBusy ? 'Exporting…' : 'Download GSTR-1 JSON'}
            </Button>
          ) : null}
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

      {receivables ? (
        <div className="panel">
          <h2 className="panel-title">
            Receivables / ageing
            <span className="panel-title-meta">
              {' '}
              · {receivables.summary.count} open ·{' '}
              {formatInr(receivables.summary.totalDue)} due
            </span>
          </h2>
          <p className="muted">
            Current {formatInr(receivables.summary.byBucket.current ?? 0)} · 1–30{' '}
            {formatInr(receivables.summary.byBucket['1-30'] ?? 0)} · 31–60{' '}
            {formatInr(receivables.summary.byBucket['31-60'] ?? 0)} · 61–90{' '}
            {formatInr(receivables.summary.byBucket['61-90'] ?? 0)} · 90+{' '}
            {formatInr(receivables.summary.byBucket['90+'] ?? 0)}
          </p>
          <DataTable
            columns={[
              { key: 'billNo', label: 'Bill' },
              { key: 'party', label: 'Party' },
              { key: 'due', label: 'Due' },
              { key: 'balance', label: 'Balance', align: 'right' },
              { key: 'age', label: 'Age' },
              { key: 'status', label: 'Status' },
            ]}
            rows={receivables.rows.map((r) => ({
              id: r.id,
              cells: {
                billNo: r.billNo,
                party: r.partyName,
                due: r.dueDate,
                balance: formatInr(r.balanceDue),
                age: `${r.daysPastDue}d (${r.bucket})`,
                status: r.paymentStatus,
              },
            }))}
            emptyText="No outstanding balances."
          />
        </div>
      ) : null}

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
    </>
  );
}
