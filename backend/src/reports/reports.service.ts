import { BadRequestException, Injectable } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus, PurchaseStatus } from '@prisma/client';
import { parseDateRange } from '../common/date-range.util';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private range(fromIso: string, toIso: string) {
    if (!fromIso || !toIso) {
      throw new BadRequestException('from and to query params are required (YYYY-MM-DD)');
    }
    try {
      return parseDateRange(fromIso, toIso);
    } catch {
      throw new BadRequestException('Invalid from/to date. Use YYYY-MM-DD.');
    }
  }

  async dayBook(tenantId: string, fromIso: string, toIso: string) {
    const { from, to } = this.range(fromIso, toIso);
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: InvoiceStatus.FINALIZED,
        deletedAt: null,
        invoiceDate: { gte: from, lte: to },
      },
      orderBy: { invoiceDate: 'asc' },
      include: { payments: true },
    });

    const entries = invoices.map((inv) => ({
      date: inv.invoiceDate.toISOString().slice(0, 10),
      billNo: inv.billNo,
      partyName: inv.partyName,
      documentType: inv.documentType,
      status: inv.status,
      taxableAmount: Number(inv.taxableAmount),
      cgstAmount: Number(inv.cgstAmount),
      sgstAmount: Number(inv.sgstAmount),
      igstAmount: Number(inv.igstAmount),
      grandTotal: Number(inv.grandTotal),
      payments: inv.payments.map((p) => ({
        mode: p.mode,
        amount: Number(p.amount),
      })),
    }));

    const totals = entries.reduce(
      (acc, e) => {
        acc.taxable += e.taxableAmount;
        acc.cgst += e.cgstAmount;
        acc.sgst += e.sgstAmount;
        acc.igst += e.igstAmount;
        acc.grand += e.grandTotal;
        return acc;
      },
      { taxable: 0, cgst: 0, sgst: 0, igst: 0, grand: 0 },
    );

    return {
      from: fromIso,
      to: toIso,
      entries,
      totals: {
        taxable: Math.round(totals.taxable * 100) / 100,
        cgst: Math.round(totals.cgst * 100) / 100,
        sgst: Math.round(totals.sgst * 100) / 100,
        igst: Math.round(totals.igst * 100) / 100,
        grand: Math.round(totals.grand * 100) / 100,
        invoiceCount: entries.length,
      },
    };
  }

  async collectionsByMode(tenantId: string, fromIso: string, toIso: string) {
    const { from, to } = this.range(fromIso, toIso);
    const payments = await this.prisma.invoicePayment.findMany({
      where: {
        tenantId,
        paidAt: { gte: from, lte: to },
        invoice: { status: InvoiceStatus.FINALIZED, deletedAt: null },
      },
    });

    const byMode: Record<string, number> = {};
    for (const p of payments) {
      const key = p.mode;
      byMode[key] = (byMode[key] ?? 0) + Number(p.amount);
    }

    const cash = Math.round((byMode.CASH ?? 0) * 100) / 100;
    const upi = Math.round((byMode.UPI ?? 0) * 100) / 100;
    const card = Math.round((byMode.CARD ?? 0) * 100) / 100;
    const total = Math.round((cash + upi + card) * 100) / 100;

    return {
      from: fromIso,
      to: toIso,
      byMode: { CASH: cash, UPI: upi, CARD: card },
      cash,
      upi,
      card,
      total,
      paymentCount: payments.length,
    };
  }

  async gstr1Export(tenantId: string, fromIso: string, toIso: string) {
    const { from, to } = this.range(fromIso, toIso);
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: InvoiceStatus.FINALIZED,
        deletedAt: null,
        invoiceDate: { gte: from, lte: to },
      },
      include: {
        lines: { orderBy: { lineNo: 'asc' } },
      },
      orderBy: { invoiceDate: 'asc' },
    });

    const b2b = invoices
      .filter((i) => i.partyGstin)
      .map((inv) => ({
        billNo: inv.billNo,
        invoiceDate: inv.invoiceDate.toISOString().slice(0, 10),
        partyGstin: inv.partyGstin,
        partyName: inv.partyName,
        placeOfSupply: inv.placeOfSupply,
        reverseCharge: inv.reverseCharge,
        invoiceValue: Number(inv.grandTotal),
        taxableValue: Number(inv.taxableAmount),
        igst: Number(inv.igstAmount),
        cgst: Number(inv.cgstAmount),
        sgst: Number(inv.sgstAmount),
        items: inv.lines.map((l) => ({
          hsnSac: l.hsnSac,
          taxableValue: Number(l.taxableValue),
          gstRate: Number(l.gstRate),
          igst: Number(l.igstAmount),
          cgst: Number(l.cgstAmount),
          sgst: Number(l.sgstAmount),
        })),
      }));

    const b2cs = invoices
      .filter((i) => !i.partyGstin)
      .reduce(
        (acc, inv) => {
          const key = inv.placeOfSupply ?? 'UNKNOWN';
          if (!acc[key]) {
            acc[key] = { placeOfSupply: key, taxable: 0, igst: 0, cgst: 0, sgst: 0 };
          }
          acc[key].taxable += Number(inv.taxableAmount);
          acc[key].igst += Number(inv.igstAmount);
          acc[key].cgst += Number(inv.cgstAmount);
          acc[key].sgst += Number(inv.sgstAmount);
          return acc;
        },
        {} as Record<
          string,
          {
            placeOfSupply: string;
            taxable: number;
            igst: number;
            cgst: number;
            sgst: number;
          }
        >,
      );

    return {
      from: fromIso,
      to: toIso,
      b2b,
      b2cs: Object.values(b2cs),
      documentCount: invoices.length,
    };
  }

  /** Outstanding receivables / ageing buckets */
  async receivables(tenantId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        status: InvoiceStatus.FINALIZED,
        deletedAt: null,
        paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL] },
      },
      orderBy: [{ dueDate: 'asc' }, { invoiceDate: 'asc' }],
      select: {
        id: true,
        billNo: true,
        partyName: true,
        partyPhone: true,
        invoiceDate: true,
        dueDate: true,
        grandTotal: true,
        amountPaid: true,
        balanceDue: true,
        paymentStatus: true,
      },
    });
    const now = new Date();
    const rows = invoices.map((inv) => {
      const due = inv.dueDate ?? inv.invoiceDate;
      const daysPastDue = Math.max(
        0,
        Math.floor((now.getTime() - due.getTime()) / (24 * 60 * 60 * 1000)),
      );
      let bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+';
      if (Number(inv.balanceDue) <= 0) bucket = 'current';
      else if (daysPastDue === 0) bucket = 'current';
      else if (daysPastDue <= 30) bucket = '1-30';
      else if (daysPastDue <= 60) bucket = '31-60';
      else if (daysPastDue <= 90) bucket = '61-90';
      else bucket = '90+';
      return {
        id: inv.id,
        billNo: inv.billNo,
        partyName: inv.partyName,
        partyPhone: inv.partyPhone,
        invoiceDate: inv.invoiceDate.toISOString().slice(0, 10),
        dueDate: due.toISOString().slice(0, 10),
        grandTotal: Number(inv.grandTotal),
        amountPaid: Number(inv.amountPaid),
        balanceDue: Number(inv.balanceDue),
        paymentStatus: inv.paymentStatus,
        daysPastDue,
        bucket,
      };
    });
    const summary = {
      totalDue: Math.round(rows.reduce((s, r) => s + r.balanceDue, 0) * 100) / 100,
      count: rows.length,
      byBucket: {
        current: 0,
        '1-30': 0,
        '31-60': 0,
        '61-90': 0,
        '90+': 0,
      } as Record<string, number>,
    };
    for (const r of rows) {
      summary.byBucket[r.bucket] = Math.round(
        ((summary.byBucket[r.bucket] ?? 0) + r.balanceDue) * 100,
      ) / 100;
    }
    return { rows, summary };
  }

  /** Purchase ITC summary for GST returns support */
  async itcSummary(tenantId: string, from?: string, to?: string) {
    const where: {
      tenantId: string;
      status: typeof PurchaseStatus.FINALIZED;
      billDate?: { gte?: Date; lte?: Date };
    } = {
      tenantId,
      status: PurchaseStatus.FINALIZED,
    };
    if (from || to) {
      where.billDate = {};
      if (from) where.billDate.gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        where.billDate.lte = end;
      }
    }
    const purchases = await this.prisma.purchaseBill.findMany({
      where,
      orderBy: { billDate: 'desc' },
      take: 500,
      select: {
        id: true,
        billNo: true,
        billDate: true,
        vendorName: true,
        vendorGstin: true,
        taxableAmount: true,
        cgstAmount: true,
        sgstAmount: true,
        igstAmount: true,
        grandTotal: true,
        itcEligible: true,
        itcCgst: true,
        itcSgst: true,
        itcIgst: true,
        itcNotes: true,
        status: true,
      },
    });
    const rows = purchases.map((p) => ({
      id: p.id,
      billNo: p.billNo,
      billDate: p.billDate.toISOString().slice(0, 10),
      vendorName: p.vendorName,
      vendorGstin: p.vendorGstin,
      taxableAmount: Number(p.taxableAmount),
      cgstAmount: Number(p.cgstAmount),
      sgstAmount: Number(p.sgstAmount),
      igstAmount: Number(p.igstAmount),
      grandTotal: Number(p.grandTotal),
      itcEligible: p.itcEligible,
      itcCgst: Number(p.itcCgst),
      itcSgst: Number(p.itcSgst),
      itcIgst: Number(p.itcIgst),
      itcTotal:
        Math.round(
          (Number(p.itcCgst) + Number(p.itcSgst) + Number(p.itcIgst)) * 100,
        ) / 100,
      itcNotes: p.itcNotes,
    }));
    const eligible = rows.filter((r) => r.itcEligible);
    const summary = {
      purchaseCount: rows.length,
      eligibleCount: eligible.length,
      taxable: Math.round(rows.reduce((s, r) => s + r.taxableAmount, 0) * 100) / 100,
      itcCgst: Math.round(eligible.reduce((s, r) => s + r.itcCgst, 0) * 100) / 100,
      itcSgst: Math.round(eligible.reduce((s, r) => s + r.itcSgst, 0) * 100) / 100,
      itcIgst: Math.round(eligible.reduce((s, r) => s + r.itcIgst, 0) * 100) / 100,
      itcTotal: 0,
    };
    summary.itcTotal =
      Math.round((summary.itcCgst + summary.itcSgst + summary.itcIgst) * 100) /
      100;
    return { rows, summary };
  }
}
