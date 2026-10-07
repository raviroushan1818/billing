import { reportsApi } from '../api';
import type {
  DayBookEntry,
  DueCollectionRow,
  PaymentRegisterRow,
  ReceivableRow,
  SettledBillRow,
} from '../types';
import { round2, shiftDaysIso, todayIso, toNum } from './format';

/** Downloads rows as a UTF-8 CSV (BOM so Excel shows ₹ and Hindi text correctly). */
export function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  const esc = (v: unknown) => {
    const text = v == null ? '' : String(v);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const body = [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob([`﻿${body}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const IST_OFFSET_MS = 330 * 60 * 1000;

/** "2026-10-08 01:27" in IST — sorts and filters cleanly in Excel. */
export function istStamp(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + IST_OFFSET_MS);
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

function istDay(iso: string): string {
  return new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

const n2 = (v: number | string | null | undefined) => round2(toNum(v)).toFixed(2);

const DOC_LABEL: Record<string, string> = {
  TAX_INVOICE: 'Invoice',
  CREDIT_NOTE: 'Credit note',
  DEBIT_NOTE: 'Debit note',
};

const MODE_LABEL: Record<string, string> = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card' };

function paidByMode(e: DayBookEntry, mode: string): number {
  return round2(
    (e.payments ?? [])
      .filter((p) => p.mode === mode)
      .reduce((s, p) => s + toNum(p.amount), 0),
  );
}

function sign(e: DayBookEntry): number {
  return e.documentType === 'CREDIT_NOTE' ? -1 : 1;
}

/** One row per day: sales, GST, collections by mode, dues recovered, still due. */
export async function exportDailySummary(from: string, to: string) {
  const [book, register] = await Promise.all([
    reportsApi.dayBook(from, to),
    reportsApi.paymentRegister(from, to),
  ]);
  const live = register.rows.filter((p) => !p.reversedAt);

  type Day = {
    bills: number;
    notes: number;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    net: number;
    stillDue: number;
    cash: number;
    upi: number;
    card: number;
    dues: number;
  };
  const blank = (): Day => ({
    bills: 0, notes: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, net: 0,
    stillDue: 0, cash: 0, upi: 0, card: 0, dues: 0,
  });
  const days = new Map<string, Day>();
  for (let d = from; d <= to; d = shiftDaysIso(d, 1)) days.set(d, blank());

  for (const e of book.entries) {
    const day = days.get(e.date.slice(0, 10)) ?? blank();
    const k = sign(e);
    if (e.documentType === 'CREDIT_NOTE') day.notes += 1;
    else day.bills += 1;
    day.taxable += k * toNum(e.taxableAmount);
    day.cgst += k * toNum(e.cgstAmount);
    day.sgst += k * toNum(e.sgstAmount);
    day.igst += k * toNum(e.igstAmount);
    day.net += k * toNum(e.grandTotal);
    if (k > 0) day.stillDue += toNum(e.balanceDue);
    days.set(e.date.slice(0, 10), day);
  }
  for (const p of live) {
    const key = istDay(p.paidAt);
    const day = days.get(key) ?? blank();
    const amt = toNum(p.amount);
    if (p.mode === 'CASH') day.cash += amt;
    else if (p.mode === 'UPI') day.upi += amt;
    else day.card += amt;
    if (p.stage === 'DUE_COLLECTION') day.dues += amt;
    days.set(key, day);
  }

  const total = blank();
  const rows = [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => {
      (Object.keys(total) as Array<keyof Day>).forEach((k) => {
        total[k] += d[k];
      });
      return dayRow(date, d);
    });
  rows.push(dayRow('TOTAL', total));

  function dayRow(label: string, d: Day) {
    const collected = d.cash + d.upi + d.card;
    return [
      label, d.bills, d.notes, n2(d.taxable), n2(d.cgst), n2(d.sgst), n2(d.igst),
      n2(d.cgst + d.sgst + d.igst), n2(d.net), n2(d.cash), n2(d.upi), n2(d.card),
      n2(collected), n2(collected - d.dues), n2(d.dues), n2(d.stillDue),
    ];
  }

  downloadCsv(
    `daily-summary-${from}-to-${to}.csv`,
    [
      'Date', 'Bills', 'Credit notes', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total GST',
      'Net sales', 'Cash collected', 'UPI collected', 'Card collected', 'Total collected',
      'Collected on new bills', 'Collected against old dues', "Still due on the day's bills",
    ],
    rows,
  );
}

/** Bill-wise register with GST split, payments by mode and balance. */
export async function exportDayBook(from: string, to: string) {
  const book = await reportsApi.dayBook(from, to);
  const rows = book.entries.map((e) => [
    e.date.slice(0, 10), e.billNo, DOC_LABEL[e.documentType ?? 'TAX_INVOICE'] ?? e.documentType,
    e.partyName, e.partyPhone ?? '', e.partyGstin ?? '', e.supplyType ?? '',
    n2(e.taxableAmount), n2(e.discountAmount), n2(e.cgstAmount), n2(e.sgstAmount),
    n2(e.igstAmount), n2(e.roundOff), n2(e.grandTotal), n2(paidByMode(e, 'CASH')),
    n2(paidByMode(e, 'UPI')), n2(paidByMode(e, 'CARD')), n2(e.amountPaid), n2(e.balanceDue),
    e.paymentStatus ?? '', e.raisedBy ?? '',
  ]);
  const t = book.totals;
  rows.push([
    'TOTAL', `${t.invoiceCount} docs`, '', '', '', '', '', n2(t.taxable), '', n2(t.cgst),
    n2(t.sgst), n2(t.igst), '', n2(t.grand), '', '', '', '', '', '', '',
  ]);
  downloadCsv(
    `day-book-${from}-to-${to}.csv`,
    [
      'Date', 'Bill No', 'Type', 'Party', 'Phone', 'GSTIN', 'Supply', 'Taxable', 'Discount',
      'CGST', 'SGST', 'IGST', 'Round off', 'Bill total', 'Paid cash', 'Paid UPI', 'Paid card',
      'Paid total', 'Balance due', 'Payment status', 'Raised by',
    ],
    rows,
  );
}

function reference(p: PaymentRegisterRow): string {
  if (p.mode === 'UPI') return p.upiRefId ?? '';
  if (p.mode === 'CARD' && p.cardLast4) return `xxxx${p.cardLast4}`;
  return '';
}

/** Every receipt in the period, including reversed entries (flagged). */
export async function exportPaymentRegister(from: string, to: string) {
  const { rows } = await reportsApi.paymentRegister(from, to);
  const valid = rows.filter((p) => !p.reversedAt);
  const out = rows.map((p) => [
    p.receiptNo ?? '', istStamp(p.paidAt), istStamp(p.recordedAt), p.billNo, p.invoiceDate,
    p.partyName, p.partyPhone ?? '', p.stage === 'DUE_COLLECTION' ? 'Due collection' : 'At billing',
    MODE_LABEL[p.mode] ?? p.mode, reference(p), n2(p.amount),
    p.reversedAt || p.balanceAfter == null ? '' : n2(p.balanceAfter), p.receivedBy ?? '',
    p.reversedAt ? 'Reversed' : 'Valid', istStamp(p.reversedAt), p.reversedBy ?? '',
    p.reversalReason ?? '', p.notes ?? '',
  ]);
  out.push([
    'TOTAL (valid)', '', '', `${valid.length} receipts`, '', '', '', '', '', '',
    n2(valid.reduce((s, p) => s + p.amount, 0)), '', '', '', '', '', '', '',
  ]);
  downloadCsv(
    `payment-register-${from}-to-${to}.csv`,
    [
      'Receipt No', 'Received on (IST)', 'Recorded on (IST)', 'Bill No', 'Bill date', 'Party',
      'Phone', 'Type', 'Mode', 'Reference', 'Amount', 'Balance after', 'Received by', 'Status',
      'Reversed on', 'Reversed by', 'Reversal reason', 'Note',
    ],
    out,
  );
}

/** HSN/SAC + GST-rate wise summary (credit notes netted off). */
export async function exportHsnSummary(from: string, to: string) {
  const { rows } = await reportsApi.hsnSummary(from, to);
  const out = rows.map((r) => [
    r.hsnSac || '(none)', r.description, r.unit, r.qty, r.gstRate, n2(r.taxable),
    n2(r.cgst), n2(r.sgst), n2(r.igst), n2(r.cess), n2(r.total),
  ]);
  const sum = (k: 'taxable' | 'cgst' | 'sgst' | 'igst' | 'cess' | 'total') =>
    n2(rows.reduce((s, r) => s + r[k], 0));
  out.push([
    'TOTAL', '', '', '', '', sum('taxable'), sum('cgst'), sum('sgst'), sum('igst'),
    sum('cess'), sum('total'),
  ]);
  downloadCsv(
    `hsn-summary-${from}-to-${to}.csv`,
    [
      'HSN/SAC', 'Description (first seen)', 'UQC', 'Total qty', 'GST rate %', 'Taxable value',
      'CGST', 'SGST', 'IGST', 'Cess', 'Total value',
    ],
    out,
  );
}

/** Purchase-side input tax credit register. */
export async function exportItc(from: string, to: string) {
  const { rows, summary } = await reportsApi.itc(from, to);
  const out = rows.map((r) => [
    r.billDate, r.billNo, r.vendorName, r.vendorGstin ?? '', n2(r.taxableAmount),
    n2(r.grandTotal), r.itcEligible ? 'Yes' : 'No', n2(r.itcCgst), n2(r.itcSgst),
    n2(r.itcIgst), n2(r.itcTotal), r.itcNotes ?? '',
  ]);
  out.push([
    'TOTAL', `${summary.purchaseCount} bills`, '', '', n2(summary.taxable), '',
    `${summary.eligibleCount} eligible`, n2(summary.itcCgst), n2(summary.itcSgst),
    n2(summary.itcIgst), n2(summary.itcTotal), '',
  ]);
  downloadCsv(
    `purchase-itc-${from}-to-${to}.csv`,
    [
      'Bill date', 'Purchase bill no', 'Vendor', 'Vendor GSTIN', 'Taxable', 'Bill total',
      'ITC eligible', 'ITC CGST', 'ITC SGST', 'ITC IGST', 'ITC total', 'Notes',
    ],
    out,
  );
}

export function csvOutstanding(rows: ReceivableRow[]) {
  downloadCsv(
    `outstanding-dues-${todayIso()}.csv`,
    [
      'Bill No', 'Bill date', 'Party', 'Phone', 'Bill total', 'Paid', 'Balance due', 'Due date',
      'Days overdue', 'Payments', 'Last payment on (IST)', 'Last payment amount', 'Last payment mode',
    ],
    [
      ...rows.map((r) => [
        r.billNo, r.invoiceDate, r.partyName, r.partyPhone ?? '', n2(r.grandTotal), n2(r.amountPaid),
        n2(r.balanceDue), r.dueDate, r.daysPastDue, r.paymentCount, istStamp(r.lastPaymentAt),
        r.lastPaymentAmount == null ? '' : n2(r.lastPaymentAmount),
        r.lastPaymentMode ? MODE_LABEL[r.lastPaymentMode] : '',
      ]),
      ['TOTAL', `${rows.length} bills`, '', '', '', '', n2(rows.reduce((s, r) => s + r.balanceDue, 0)), '', '', '', '', '', ''],
    ],
  );
}

export function csvDueCollections(rows: DueCollectionRow[], from: string, to: string) {
  downloadCsv(
    `due-collections-${from}-to-${to}.csv`,
    [
      'Receipt No', 'Received on (IST)', 'Recorded on (IST)', 'Bill No', 'Bill date', 'Party', 'Phone',
      'Mode', 'Reference', 'Amount', 'Balance before', 'Balance after', 'Settled', 'Days after bill',
      'Received by', 'Note',
    ],
    [
      ...rows.map((r) => [
        r.receiptNo ?? '', istStamp(r.paidAt), istStamp(r.recordedAt), r.billNo, r.invoiceDate,
        r.partyName, r.partyPhone ?? '', MODE_LABEL[r.mode] ?? r.mode, r.reference ?? '', n2(r.amount),
        r.balanceBefore == null ? '' : n2(r.balanceBefore),
        r.balanceAfter == null ? '' : n2(r.balanceAfter), r.settled ? 'Yes' : 'No',
        r.daysAfterBill, r.receivedBy ?? '', r.notes ?? '',
      ]),
      ['TOTAL', '', '', `${rows.length} receipts`, '', '', '', '', '', n2(rows.reduce((s, r) => s + r.amount, 0)), '', '', '', '', '', ''],
    ],
  );
}

export function csvSettled(rows: SettledBillRow[], from: string, to: string) {
  downloadCsv(
    `settled-bills-${from}-to-${to}.csv`,
    [
      'Bill No', 'Bill date', 'Party', 'Phone', 'Bill total', 'Paid at billing', 'Collected later',
      'Instalments', 'Settled on (IST)', 'Days to settle',
    ],
    rows.map((r) => [
      r.billNo, r.invoiceDate, r.partyName, r.partyPhone ?? '', n2(r.grandTotal), n2(r.paidAtBilling),
      n2(r.collectedLater), r.installments, istStamp(r.settledAt), r.daysToSettle,
    ]),
  );
}

export async function exportOutstanding() {
  const { rows } = await reportsApi.receivables();
  csvOutstanding(rows);
}

export async function exportDueCollections(from: string, to: string) {
  const rep = await reportsApi.dueSettlements(from, to);
  csvDueCollections(rep.collections, from, to);
}

export async function exportSettled(from: string, to: string) {
  const rep = await reportsApi.dueSettlements(from, to);
  csvSettled(rep.settled, from, to);
}
