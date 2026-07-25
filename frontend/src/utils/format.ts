export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatInr(value: number | string | undefined | null): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function toNum(value: number | string | undefined | null): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function shiftDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function startOfMonthIso(iso = todayIso()): string {
  const [y, m] = iso.split('-');
  return `${y}-${m}-01`;
}

export function formatPayments(
  payments?: Array<{ mode: string; amount: number | string }>,
): string {
  if (!payments?.length) return '—';
  return payments
    .map((p) => `${p.mode} ${formatInr(toNum(p.amount))}`)
    .join(', ');
}

export function lineTotal(
  qty: number,
  rate: number,
  discount: number,
  gstRate: number,
): number {
  const taxable = Math.max(0, qty * rate - discount);
  const gst = (taxable * gstRate) / 100;
  return round2(taxable + gst);
}

/** Matches backend invoice create: paise subtotal, then round payable to nearest ₹. */
export function calcBillTotals(
  lines: Array<{
    qty: number;
    rate: number;
    discount: number;
    gstRate: number;
  }>,
): { subtotal: number; grandTotal: number; roundOff: number } {
  const subtotal = round2(
    lines.reduce(
      (sum, l) => sum + lineTotal(l.qty, l.rate, l.discount, l.gstRate),
      0,
    ),
  );
  const grandTotal = Math.round(subtotal);
  const roundOff = round2(grandTotal - subtotal);
  return { subtotal, grandTotal, roundOff };
}

export function calcGrandTotal(
  lines: Array<{
    qty: number;
    rate: number;
    discount: number;
    gstRate: number;
  }>,
): number {
  return calcBillTotals(lines).grandTotal;
}
