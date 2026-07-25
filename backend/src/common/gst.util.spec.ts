import {
  computeLineGst,
  paymentsMatchTotal,
  financialYear,
  formatBillNo,
} from './gst.util';

describe('computeLineGst', () => {
  it('splits CGST/SGST for intra-state', () => {
    const result = computeLineGst({
      qty: 2,
      rate: 100,
      gstRate: 18,
      interstate: false,
    });
    expect(result.taxableValue).toBe(200);
    expect(result.cgst).toBe(18);
    expect(result.sgst).toBe(18);
    expect(result.igst).toBe(0);
    expect(result.lineTotal).toBe(236);
  });

  it('uses IGST for inter-state', () => {
    const result = computeLineGst({
      qty: 1,
      rate: 1000,
      gstRate: 18,
      interstate: true,
    });
    expect(result.taxableValue).toBe(1000);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
    expect(result.igst).toBe(180);
    expect(result.lineTotal).toBe(1180);
  });

  it('applies discount before tax', () => {
    const result = computeLineGst({
      qty: 1,
      rate: 100,
      discount: 10,
      gstRate: 18,
      interstate: false,
    });
    expect(result.taxableValue).toBe(90);
    expect(result.lineTotal).toBe(106.2);
  });
});

describe('paymentsMatchTotal', () => {
  it('returns true when sum matches grand total', () => {
    expect(
      paymentsMatchTotal([{ amount: 500 }, { amount: 500 }], 1000),
    ).toBe(true);
  });

  it('returns false when sum differs', () => {
    expect(paymentsMatchTotal([{ amount: 400 }], 1000)).toBe(false);
  });

  it('allows small rounding tolerance', () => {
    expect(
      paymentsMatchTotal([{ amount: 999.995 }], 1000),
    ).toBe(true);
  });
});

describe('financialYear', () => {
  it('returns correct FY for April start', () => {
    expect(financialYear(new Date('2026-07-21'), 4)).toBe('2026-27');
    expect(financialYear(new Date('2026-03-15'), 4)).toBe('2025-26');
  });
});

describe('formatBillNo', () => {
  it('formats bill number with padded sequence', () => {
    expect(formatBillNo('INV', '2026-27', 42)).toBe('INV-202627-0042');
  });
});
