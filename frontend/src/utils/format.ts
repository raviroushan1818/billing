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

/** Line discount mode: flat INR amount or percent of (qty × rate). */
export type DiscountType = 'INR' | 'PCT';

/** Convert UI discount value to absolute ₹ before tax. */
export function discountAmount(
  qty: number,
  rate: number,
  discount: number,
  discountType: DiscountType = 'INR',
): number {
  const lineValue = Math.max(0, qty * rate);
  if (discountType === 'PCT') {
    const pct = Math.min(100, Math.max(0, discount));
    return round2((lineValue * pct) / 100);
  }
  return round2(Math.min(lineValue, Math.max(0, discount)));
}

export function lineTotal(
  qty: number,
  rate: number,
  discount: number,
  gstRate: number,
  discountType: DiscountType = 'INR',
): number {
  const disc = discountAmount(qty, rate, discount, discountType);
  const taxable = Math.max(0, qty * rate - disc);
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
    discountType?: DiscountType;
  }>,
): { subtotal: number; grandTotal: number; roundOff: number } {
  const subtotal = round2(
    lines.reduce(
      (sum, l) =>
        sum +
        lineTotal(
          l.qty,
          l.rate,
          l.discount,
          l.gstRate,
          l.discountType ?? 'INR',
        ),
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
    discountType?: DiscountType;
  }>,
): number {
  return calcBillTotals(lines).grandTotal;
}

/** Taxable (excl. GST) rate from a GST-inclusive / total amount. */
export function exclusiveFromInclusive(
  inclusive: number,
  gstPct: number,
): number {
  const amount = Math.max(0, inclusive);
  const pct = Math.max(0, gstPct);
  if (pct <= 0) return round2(amount);
  return round2(amount / (1 + pct / 100));
}

/** GST-inclusive total from a taxable (excl. GST) rate. */
export function inclusiveFromExclusive(
  exclusive: number,
  gstPct: number,
): number {
  return round2(Math.max(0, exclusive) * (1 + Math.max(0, gstPct) / 100));
}

export function gstComponent(exclusive: number, gstPct: number): number {
  return round2(Math.max(0, exclusive) * (Math.max(0, gstPct) / 100));
}
