export type GstSplit = {
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  lineTotal: number;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Compute GST for a line. Interstate => IGST; else CGST+SGST split equally. */
export function computeLineGst(input: {
  qty: number;
  rate: number;
  discount?: number;
  gstRate: number;
  interstate: boolean;
}): GstSplit {
  const discount = input.discount ?? 0;
  const taxableValue = round2(Math.max(0, input.qty * input.rate - discount));
  const tax = round2((taxableValue * input.gstRate) / 100);

  if (input.interstate) {
    return {
      taxableValue,
      cgst: 0,
      sgst: 0,
      igst: tax,
      lineTotal: round2(taxableValue + tax),
    };
  }

  const half = round2(tax / 2);
  const other = round2(tax - half);
  return {
    taxableValue,
    cgst: half,
    sgst: other,
    igst: 0,
    lineTotal: round2(taxableValue + tax),
  };
}

export function paymentsMatchTotal(
  payments: { amount: number }[],
  grandTotal: number,
  tolerance = 0.01,
): boolean {
  const sum = round2(payments.reduce((a, p) => a + Number(p.amount), 0));
  return Math.abs(sum - round2(grandTotal)) <= tolerance;
}

/** Allow partial pay: sum may be 0..grandTotal (not over). */
export function paymentsWithinTotal(
  payments: { amount: number }[],
  grandTotal: number,
  tolerance = 0.01,
): boolean {
  const sum = round2(payments.reduce((a, p) => a + Number(p.amount), 0));
  if (sum < -tolerance) return false;
  return sum <= round2(grandTotal) + tolerance;
}

export function paymentStatusFromAmounts(
  amountPaid: number,
  grandTotal: number,
  tolerance = 0.01,
): 'UNPAID' | 'PARTIAL' | 'PAID' {
  const paid = round2(amountPaid);
  const total = round2(grandTotal);
  if (paid <= tolerance) return 'UNPAID';
  if (paid + tolerance >= total) return 'PAID';
  return 'PARTIAL';
}

/** Indian FY label from a date, e.g. 2026-07-21 with fyStartMonth=4 => "2026-27" */
export function financialYear(date: Date, fyStartMonth = 4): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  if (m >= fyStartMonth) {
    const next = String((y + 1) % 100).padStart(2, '0');
    return `${y}-${next}`;
  }
  const prev = y - 1;
  const cur = String(y % 100).padStart(2, '0');
  return `${prev}-${cur}`;
}

export function formatBillNo(prefix: string, fy: string, seq: number): string {
  const fyCompact = fy.replace('-', '');
  return `${prefix}-${fyCompact}-${String(seq).padStart(4, '0')}`;
}
