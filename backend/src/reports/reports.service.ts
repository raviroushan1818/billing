import { BadRequestException, Injectable } from '@nestjs/common';
import {
  InvoiceStatus,
  PaymentStage,
  PaymentStatus,
  PurchaseStatus,
} from '@prisma/client';
import {
  istDaysSince,
  parseDateRange,
  parseIstDateRange,
} from '../common/date-range.util';
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

  /** Like range(), but IST day bounds for real timestamps such as paidAt. */
  private istRange(fromIso: string, toIso: string) {
    this.range(fromIso, toIso);
    return parseIstDateRange(fromIso, toIso);
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
      orderBy: [{ invoiceDate: 'asc' }, { billNo: 'asc' }],
      include: {
        payments: { where: { reversedAt: null } },
        createdBy: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    const entries = invoices.map((inv) => ({
      id: inv.id,
      date: inv.invoiceDate.toISOString().slice(0, 10),
      billNo: inv.billNo,
      partyName: inv.partyName,
      partyPhone: inv.partyPhone,
      partyGstin: inv.partyGstin,
      supplyType: inv.supplyType,
      discountAmount: Number(inv.discountAmount),
      roundOff: Number(inv.roundOff),
      amountPaid: Number(inv.amountPaid),
      balanceDue: Number(inv.balanceDue),
      paymentStatus: inv.paymentStatus,
      raisedBy: inv.createdBy
        ? `${inv.createdBy.firstName} ${inv.createdBy.lastName}`.trim() ||
          inv.createdBy.email
        : null,
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
    const { from, to } = this.istRange(fromIso, toIso);
    const payments = await this.prisma.invoicePayment.findMany({
      where: {
        tenantId,
        reversedAt: null,
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

  /** Every payment receipt in the period (IST days), reversed entries flagged. */
  async paymentRegister(tenantId: string, fromIso: string, toIso: string) {
    const { from, to } = this.istRange(fromIso, toIso);
    const name = (u: { firstName: string; lastName: string; email: string } | null) =>
      u ? `${u.firstName} ${u.lastName}`.trim() || u.email : null;
    const actor = { select: { firstName: true, lastName: true, email: true } };
    const rows = await this.prisma.invoicePayment.findMany({
      where: {
        tenantId,
        paidAt: { gte: from, lte: to },
        invoice: { status: InvoiceStatus.FINALIZED, deletedAt: null },
      },
      orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
      include: {
        receivedBy: actor,
        reversedBy: actor,
        invoice: {
          select: {
            id: true,
            billNo: true,
            invoiceDate: true,
            partyName: true,
            partyPhone: true,
            grandTotal: true,
          },
        },
      },
    });
    return {
      from: fromIso,
      to: toIso,
      rows: rows.map((p) => ({
        id: p.id,
        receiptNo: p.receiptNo,
        paidAt: p.paidAt.toISOString(),
        recordedAt: p.createdAt.toISOString(),
        invoiceId: p.invoice.id,
        billNo: p.invoice.billNo,
        invoiceDate: p.invoice.invoiceDate.toISOString().slice(0, 10),
        partyName: p.invoice.partyName,
        partyPhone: p.invoice.partyPhone,
        billTotal: Number(p.invoice.grandTotal),
        stage: p.stage,
        mode: p.mode,
        upiRefId: p.upiRefId,
        cardLast4: p.cardLast4,
        amount: Number(p.amount),
        balanceAfter: p.balanceAfter == null ? null : Number(p.balanceAfter),
        receivedBy: name(p.receivedBy),
        notes: p.notes,
        reversedAt: p.reversedAt?.toISOString() ?? null,
        reversedBy: name(p.reversedBy),
        reversalReason: p.reversalReason,
      })),
    };
  }

  /** HSN/SAC + GST-rate wise summary of finalized documents (credit notes negative). */
  async hsnSummary(tenantId: string, fromIso: string, toIso: string) {
    const { from, to } = this.range(fromIso, toIso);
    const lines = await this.prisma.invoiceLine.findMany({
      where: {
        tenantId,
        invoice: {
          status: InvoiceStatus.FINALIZED,
          deletedAt: null,
          invoiceDate: { gte: from, lte: to },
        },
      },
      select: {
        hsnSac: true,
        description: true,
        unit: true,
        qty: true,
        taxableValue: true,
        gstRate: true,
        cgstAmount: true,
        sgstAmount: true,
        igstAmount: true,
        cessAmount: true,
        lineTotal: true,
        invoice: { select: { documentType: true } },
      },
    });
    const round = (n: number) => Math.round(n * 100) / 100;
    const groups = new Map<
      string,
      {
        hsnSac: string;
        gstRate: number;
        unit: string;
        description: string;
        qty: number;
        taxable: number;
        cgst: number;
        sgst: number;
        igst: number;
        cess: number;
        total: number;
        lineCount: number;
      }
    >();
    for (const l of lines) {
      const sign = l.invoice.documentType === 'CREDIT_NOTE' ? -1 : 1;
      const hsn = l.hsnSac?.trim() || '';
      const rate = Number(l.gstRate);
      const key = `${hsn}|${rate}|${l.unit}`;
      const g =
        groups.get(key) ??
        {
          hsnSac: hsn,
          gstRate: rate,
          unit: l.unit,
          description: l.description,
          qty: 0,
          taxable: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          cess: 0,
          total: 0,
          lineCount: 0,
        };
      g.qty += sign * Number(l.qty);
      g.taxable += sign * Number(l.taxableValue);
      g.cgst += sign * Number(l.cgstAmount);
      g.sgst += sign * Number(l.sgstAmount);
      g.igst += sign * Number(l.igstAmount);
      g.cess += sign * Number(l.cessAmount);
      g.total += sign * Number(l.lineTotal);
      g.lineCount += 1;
      groups.set(key, g);
    }
    const rows = [...groups.values()]
      .map((g) => ({
        ...g,
        qty: Math.round(g.qty * 1000) / 1000,
        taxable: round(g.taxable),
        cgst: round(g.cgst),
        sgst: round(g.sgst),
        igst: round(g.igst),
        cess: round(g.cess),
        total: round(g.total),
      }))
      .sort((a, b) => a.hsnSac.localeCompare(b.hsnSac) || a.gstRate - b.gstRate);
    return { from: fromIso, to: toIso, rows };
  }

  /** Outstanding receivables / ageing buckets */
  async receivables(tenantId: string, fromIso?: string, toIso?: string) {
    const paymentRange = fromIso && toIso ? this.range(fromIso, toIso) : null;
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
        payments: {
          where: { reversedAt: null },
          orderBy: { paidAt: 'desc' },
          take: 1,
          select: { paidAt: true, amount: true, mode: true },
        },
        _count: { select: { payments: { where: { reversedAt: null } } } },
      },
    });
    const paymentActivity = await this.prisma.invoicePayment.findMany({
      where: {
        tenantId,
        ...(paymentRange
          ? { paidAt: { gte: paymentRange.from, lte: paymentRange.to } }
          : {}),
        invoice: { status: InvoiceStatus.FINALIZED, deletedAt: null },
      },
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        mode: true,
        amount: true,
        upiRefId: true,
        cardLast4: true,
        notes: true,
        paidAt: true,
        receiptNo: true,
        stage: true,
        balanceAfter: true,
        reversedAt: true,
        reversalReason: true,
        receivedBy: { select: { firstName: true, lastName: true } },
        invoice: {
          select: {
            id: true,
            billNo: true,
            partyName: true,
            grandTotal: true,
          },
        },
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
        paymentCount: inv._count.payments,
        lastPaymentAt: inv.payments[0]?.paidAt.toISOString() ?? null,
        lastPaymentAmount: inv.payments[0] ? Number(inv.payments[0].amount) : null,
        lastPaymentMode: inv.payments[0]?.mode ?? null,
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
    return {
      rows,
      summary,
      paymentActivity: paymentActivity.map((payment) => ({
        id: payment.id,
        invoiceId: payment.invoice.id,
        billNo: payment.invoice.billNo,
        partyName: payment.invoice.partyName,
        grandTotal: Number(payment.invoice.grandTotal),
        paidAt: payment.paidAt.toISOString(),
        receiptNo: payment.receiptNo,
        mode: payment.mode,
        amount: Number(payment.amount),
        upiRefId: payment.upiRefId,
        cardLast4: payment.cardLast4,
        notes: payment.notes,
        stage: payment.stage,
        balanceAfter:
          payment.balanceAfter == null ? null : Number(payment.balanceAfter),
        receivedBy: payment.receivedBy
          ? `${payment.receivedBy.firstName} ${payment.receivedBy.lastName}`.trim()
          : null,
        reversedAt: payment.reversedAt?.toISOString() ?? null,
        reversalReason: payment.reversalReason,
      })),
    };
  }

  /**
   * Due settlement register for a period: every payment collected later against
   * a bill's balance due (with balance before/after and who received it), the
   * bills fully settled in the period, and credit given on bills raised in it.
   */
  async dueSettlements(tenantId: string, fromIso: string, toIso: string) {
    // invoiceDate is a calendar date; paidAt/settledAt are instants (IST days).
    const { from: billFrom, to: billTo } = this.range(fromIso, toIso);
    const { from, to } = this.istRange(fromIso, toIso);
    const round = (n: number) => Math.round(n * 100) / 100;
    const liveInvoice = { status: InvoiceStatus.FINALIZED, deletedAt: null };

    const [collections, settledBills, raised] = await Promise.all([
      this.prisma.invoicePayment.findMany({
        where: {
          tenantId,
          stage: PaymentStage.DUE_COLLECTION,
          reversedAt: null,
          paidAt: { gte: from, lte: to },
          invoice: liveInvoice,
        },
        orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          invoice: {
            select: {
              id: true,
              billNo: true,
              invoiceDate: true,
              partyName: true,
              partyPhone: true,
              grandTotal: true,
            },
          },
          receivedBy: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.invoice.findMany({
        where: {
          tenantId,
          ...liveInvoice,
          paymentStatus: PaymentStatus.PAID,
          settledAt: { gte: from, lte: to },
          payments: {
            some: { stage: PaymentStage.DUE_COLLECTION, reversedAt: null },
          },
        },
        orderBy: { settledAt: 'desc' },
        select: {
          id: true,
          billNo: true,
          invoiceDate: true,
          partyName: true,
          partyPhone: true,
          grandTotal: true,
          settledAt: true,
          payments: {
            where: { reversedAt: null },
            orderBy: { paidAt: 'asc' },
            select: { amount: true, mode: true, stage: true, paidAt: true },
          },
        },
      }),
      this.prisma.invoice.findMany({
        where: {
          tenantId,
          ...liveInvoice,
          invoiceDate: { gte: billFrom, lte: billTo },
        },
        select: {
          grandTotal: true,
          payments: {
            where: { stage: PaymentStage.AT_BILLING, reversedAt: null },
            select: { amount: true },
          },
        },
      }),
    ]);

    const actorName = (
      u: { firstName: string; lastName: string; email: string } | null,
    ) => (u ? `${u.firstName} ${u.lastName}`.trim() || u.email : null);

    const collectionRows = collections.map((p) => {
      const amount = Number(p.amount);
      const balanceAfter =
        p.balanceAfter != null ? Number(p.balanceAfter) : null;
      return {
        id: p.id,
        receiptNo: p.receiptNo,
        paidAt: p.paidAt.toISOString(),
        recordedAt: p.createdAt.toISOString(),
        invoiceId: p.invoice.id,
        billNo: p.invoice.billNo,
        invoiceDate: p.invoice.invoiceDate.toISOString().slice(0, 10),
        partyName: p.invoice.partyName,
        partyPhone: p.invoice.partyPhone,
        billTotal: Number(p.invoice.grandTotal),
        mode: p.mode,
        reference:
          p.mode === 'UPI'
            ? p.upiRefId
            : p.mode === 'CARD' && p.cardLast4
              ? `•••• ${p.cardLast4}`
              : null,
        amount,
        balanceBefore: balanceAfter != null ? round(balanceAfter + amount) : null,
        balanceAfter,
        settled: balanceAfter != null && balanceAfter <= 0.01,
        daysAfterBill: istDaysSince(p.invoice.invoiceDate, p.paidAt),
        receivedBy: actorName(p.receivedBy),
        notes: p.notes,
      };
    });

    const settledRows = settledBills.map((inv) => {
      const settledAt = inv.settledAt ?? inv.invoiceDate;
      const sum = (stage: PaymentStage) =>
        round(
          inv.payments
            .filter((p) => p.stage === stage)
            .reduce((s, p) => s + Number(p.amount), 0),
        );
      return {
        id: inv.id,
        billNo: inv.billNo,
        invoiceDate: inv.invoiceDate.toISOString().slice(0, 10),
        partyName: inv.partyName,
        partyPhone: inv.partyPhone,
        grandTotal: Number(inv.grandTotal),
        paidAtBilling: sum(PaymentStage.AT_BILLING),
        collectedLater: sum(PaymentStage.DUE_COLLECTION),
        installments: inv.payments.filter(
          (p) => p.stage === PaymentStage.DUE_COLLECTION,
        ).length,
        settledAt: settledAt.toISOString(),
        daysToSettle: istDaysSince(inv.invoiceDate, settledAt),
      };
    });

    const creditGiven = round(
      raised.reduce((s, inv) => {
        const paidNow = inv.payments.reduce((a, p) => a + Number(p.amount), 0);
        return s + Math.max(0, Number(inv.grandTotal) - paidNow);
      }, 0),
    );
    const recovered = round(collectionRows.reduce((s, r) => s + r.amount, 0));
    const byMode: Record<string, number> = { CASH: 0, UPI: 0, CARD: 0 };
    for (const r of collectionRows) {
      byMode[r.mode] = round((byMode[r.mode] ?? 0) + r.amount);
    }

    return {
      from: fromIso,
      to: toIso,
      summary: {
        creditGiven,
        recovered,
        collectionCount: collectionRows.length,
        settledCount: settledRows.length,
        recoveredByMode: byMode,
      },
      collections: collectionRows,
      settled: settledRows,
    };
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
