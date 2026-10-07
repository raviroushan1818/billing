import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  DocumentType,
  EinvoiceStatus,
  InvoiceStatus,
  PaymentMode,
  PaymentStage,
  PaymentStatus,
  Prisma,
  SupplyType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GstService } from '../gst/gst.service';
import { AuditService } from '../audit/audit.service';
import { PdfService } from '../pdf/pdf.service';
import { EinvoiceService } from '../einvoice/einvoice.service';
import { StorageService } from '../storage/storage.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { BillingService } from '../billing/billing.service';
import { InventoryService } from '../inventory/inventory.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  computeLineGst,
  financialYear,
  formatBillNo,
  paymentStatusFromAmounts,
  paymentsWithinTotal,
} from '../common/gst.util';
import { compactPartyMeta } from '../common/party-meta.util';
import { istDateOf } from '../common/date-range.util';
import {
  AddPaymentDto,
  CreateInvoiceDto,
  CreateNoteDto,
  ListInvoicesQueryDto,
  ShareEmailDto,
  ShareWhatsappDto,
  UpdateDraftInvoiceDto,
} from './dto/invoice.dto';
import { InvoicePrintData } from '../einvoice/einvoice.provider';
import { HmsService } from '../hms/hms.service';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function dec(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(2));
}

/** Payment rows taken on the bill itself, with receipt no + running balance. */
function atBillingPayments(
  tenantId: string,
  billNo: string,
  grandTotal: number,
  receivedById: string,
  rows: Array<{
    mode: PaymentMode;
    amount: number;
    upiRefId?: string;
    cardLast4?: string;
    notes?: string;
  }>,
): Prisma.InvoicePaymentCreateWithoutInvoiceInput[] {
  let paid = 0;
  return rows.map((p, i) => {
    paid = round2(paid + Number(p.amount));
    return {
      tenantId,
      mode: p.mode,
      amount: dec(Number(p.amount)),
      upiRefId: p.upiRefId,
      cardLast4: p.cardLast4,
      notes: p.notes,
      receiptNo: `${billNo}/R${i + 1}`,
      stage: PaymentStage.AT_BILLING,
      balanceAfter: dec(Math.max(0, grandTotal - paid)),
      receivedBy: { connect: { id: receivedById } },
    };
  });
}

const ACTOR_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
} as const;

const INVOICE_INCLUDE = {
  lines: {
    orderBy: { lineNo: 'asc' as const },
    include: {
      godown: { select: { id: true, name: true, code: true } },
    },
  },
  payments: {
    orderBy: [{ paidAt: 'asc' as const }, { createdAt: 'asc' as const }],
    include: {
      receivedBy: { select: ACTOR_SELECT },
      reversedBy: { select: ACTOR_SELECT },
    },
  },
  createdBy: { select: ACTOR_SELECT },
  finalizedBy: { select: ACTOR_SELECT },
  voidedBy: { select: ACTOR_SELECT },
};

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gst: GstService,
    private readonly audit: AuditService,
    private readonly pdf: PdfService,
    private readonly einvoice: EinvoiceService,
    private readonly storage: StorageService,
    private readonly integrations: IntegrationsService,
    private readonly billing: BillingService,
    private readonly inventory: InventoryService,
    @Inject(forwardRef(() => HmsService))
    private readonly hms: HmsService,
  ) {}

  async create(
    actor: AuthUser,
    dto: CreateInvoiceDto,
    documentType: DocumentType = DocumentType.TAX_INVOICE,
    referenceInvoiceId?: string,
  ) {
    await this.billing.assertCanCreateInvoice(actor.tenantId);

    const gstSettings = await this.gst.get(actor.tenantId);
    if (!gstSettings) {
      throw new BadRequestException('GST settings required before invoicing');
    }

    const invoiceDate = dto.invoiceDate ? new Date(dto.invoiceDate) : new Date();
    const fy = financialYear(invoiceDate, gstSettings.fyStartMonth);
    const sellerStateCode = gstSettings.stateCode;
    const partyStateCode = dto.partyStateCode ?? sellerStateCode;
    const interstate =
      partyStateCode.trim().toUpperCase() !==
      sellerStateCode.trim().toUpperCase();

    let taxableAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    const computedLines = dto.lines.map((line, idx) => {
      const gstRate = line.gstRate ?? Number(gstSettings.defaultGstRate);
      const split = computeLineGst({
        qty: line.qty,
        rate: line.rate,
        discount: line.discount,
        gstRate,
        interstate,
      });

      taxableAmount = round2(taxableAmount + split.taxableValue);
      cgstAmount = round2(cgstAmount + split.cgst);
      sgstAmount = round2(sgstAmount + split.sgst);
      igstAmount = round2(igstAmount + split.igst);

      return {
        lineNo: idx + 1,
        itemId: line.itemId,
        godownId: line.godownId,
        description: line.description,
        hsnSac: line.hsnSac,
        unit: line.unit ?? 'NOS',
        qty: line.qty,
        rate: line.rate,
        discount: line.discount ?? 0,
        taxableValue: split.taxableValue,
        gstRate,
        cgstAmount: split.cgst,
        sgstAmount: split.sgst,
        igstAmount: split.igst,
        cessAmount: 0,
        lineTotal: split.lineTotal,
      };
    });

    const discountAmount = dto.discountAmount ?? 0;
    const subtotal = round2(taxableAmount + cgstAmount + sgstAmount + igstAmount);
    const grandBeforeRound = round2(subtotal - discountAmount);
    const grandTotal = Math.round(grandBeforeRound);
    const roundOff = round2(grandTotal - grandBeforeRound);

    const paymentRows = (dto.payments ?? []).filter((p) => Number(p.amount) > 0);
    if (
      !paymentsWithinTotal(
        paymentRows.map((p) => ({ amount: p.amount })),
        grandTotal,
      )
    ) {
      const paid = round2(
        paymentRows.reduce((a, p) => a + Number(p.amount), 0),
      );
      throw new BadRequestException(
        `Payment total (${paid.toFixed(2)}) cannot exceed grand total (${grandTotal.toFixed(2)})`,
      );
    }
    const amountPaid = round2(
      paymentRows.reduce((a, p) => a + Number(p.amount), 0),
    );
    const balanceDue = round2(Math.max(0, grandTotal - amountPaid));
    const paymentStatus = paymentStatusFromAmounts(
      amountPaid,
      grandTotal,
    ) as PaymentStatus;
    const dueDate = dto.dueDate
      ? new Date(dto.dueDate)
      : balanceDue > 0.01
        ? new Date(invoiceDate.getTime() + 7 * 24 * 60 * 60 * 1000)
        : null;

    const supplyType =
      dto.supplyType ??
      (dto.partyGstin ? SupplyType.B2B : SupplyType.B2C);

    const sellerAddress = [
      gstSettings.addressLine1,
      gstSettings.addressLine2,
      gstSettings.city,
      gstSettings.state,
      gstSettings.pincode,
    ]
      .filter(Boolean)
      .join(', ');

    const status = dto.finalize === false ? InvoiceStatus.DRAFT : InvoiceStatus.FINALIZED;
    const prefix =
      documentType === DocumentType.CREDIT_NOTE
        ? 'CN'
        : documentType === DocumentType.DEBIT_NOTE
          ? 'DN'
          : 'INV';

    if (
      status === InvoiceStatus.FINALIZED &&
      documentType === DocumentType.TAX_INVOICE
    ) {
      await this.inventory.assertSaleStock(
        actor.tenantId,
        computedLines.map((l) => ({
          itemId: l.itemId,
          qty: Number(l.qty),
          godownId: l.godownId,
        })),
      );
    }

    const invoice = await this.prisma.$transaction(async (tx) => {
      const seqKey = {
        tenantId: actor.tenantId,
        fy,
        prefix,
      };

      const existing = await tx.invoiceSequence.findUnique({
        where: { tenantId_fy_prefix: seqKey },
      });

      let allocatedNo: number;
      if (!existing) {
        await tx.invoiceSequence.create({
          data: { ...seqKey, nextNo: 2 },
        });
        allocatedNo = 1;
      } else {
        allocatedNo = existing.nextNo;
        await tx.invoiceSequence.update({
          where: { id: existing.id },
          data: { nextNo: existing.nextNo + 1 },
        });
      }

      const finalBillNo = formatBillNo(prefix, fy, allocatedNo);

      const created = await tx.invoice.create({
        data: {
          tenantId: actor.tenantId,
          billNo: finalBillNo,
          documentType,
          status,
          invoiceDate,
          fy,
          partyId: dto.partyId,
          partyName: dto.partyName,
          partyPhone: dto.partyPhone,
          partyAddress: dto.partyAddress,
          partyGstin: dto.partyGstin?.toUpperCase(),
          partyStateCode,
          partyExternalId: dto.partyExternalId,
          referredBy: dto.referredBy,
          placeOfSupply: dto.placeOfSupply ?? gstSettings.state,
          supplyType,
          reverseCharge: dto.reverseCharge ?? false,
          referenceInvoiceId,
          sellerGstin: gstSettings.gstin,
          sellerLegalName: gstSettings.legalName,
          sellerStateCode,
          sellerAddress,
          taxableAmount: dec(taxableAmount),
          cgstAmount: dec(cgstAmount),
          sgstAmount: dec(sgstAmount),
          igstAmount: dec(igstAmount),
          discountAmount: dec(discountAmount),
          grandTotal: dec(grandTotal),
          roundOff: dec(roundOff),
          amountPaid: dec(amountPaid),
          balanceDue: dec(balanceDue),
          paymentStatus,
          dueDate,
          settledAt: paymentStatus === PaymentStatus.PAID ? new Date() : null,
          notes: dto.notes,
          partyMeta: compactPartyMeta(dto.partyMeta),
          createdById: actor.userId,
          ...(status === InvoiceStatus.FINALIZED
            ? { finalizedById: actor.userId, finalizedAt: new Date() }
            : {}),
          einvoiceStatus: EinvoiceStatus.NOT_APPLICABLE,
          lines: {
            create: computedLines.map((l) => ({
              tenantId: actor.tenantId,
              lineNo: l.lineNo,
              itemId: l.itemId,
              godownId: l.godownId,
              description: l.description,
              hsnSac: l.hsnSac,
              unit: l.unit,
              qty: l.qty,
              rate: l.rate,
              discount: l.discount,
              taxableValue: dec(l.taxableValue),
              gstRate: l.gstRate,
              cgstAmount: dec(l.cgstAmount),
              sgstAmount: dec(l.sgstAmount),
              igstAmount: dec(l.igstAmount),
              cessAmount: dec(0),
              lineTotal: dec(l.lineTotal),
            })),
          },
          payments: {
            create: atBillingPayments(
              actor.tenantId,
              finalBillNo,
              grandTotal,
              actor.userId,
              paymentRows,
            ),
          },
        },
        include: {
          lines: { orderBy: { lineNo: 'asc' } },
          payments: true,
        },
      });

      return created;
    });

    await this.persistPartyDemographics(
      actor.tenantId,
      dto.partyId,
      dto.partyMeta,
    );

    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'INVOICE_CREATED',
      entityType: 'Invoice',
      entityId: invoice.id,
      meta: { billNo: invoice.billNo, grandTotal: Number(invoice.grandTotal) },
    });

    if (
      status === InvoiceStatus.FINALIZED &&
      documentType === DocumentType.TAX_INVOICE
    ) {
      await this.inventory.deductSale(
        actor.tenantId,
        computedLines.map((l) => ({
          itemId: l.itemId,
          qty: Number(l.qty),
          godownId: l.godownId,
        })),
        invoice.id,
        actor.userId,
      );
    }

    if (status === InvoiceStatus.FINALIZED) {
      await this.einvoice.processAfterCreate(invoice.id, actor.tenantId);
    }

    return this.get(actor.tenantId, invoice.id);
  }

  async updateDraft(actor: AuthUser, id: string, dto: UpdateDraftInvoiceDto) {
    const existing = await this.get(actor.tenantId, id);
    if (existing.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only draft invoices can be edited');
    }
    if (existing.documentType !== DocumentType.TAX_INVOICE) {
      throw new BadRequestException('Only tax invoice drafts can be edited here');
    }

    const gstSettings = await this.gst.get(actor.tenantId);
    if (!gstSettings) {
      throw new BadRequestException('GST settings required before invoicing');
    }

    const invoiceDate = dto.invoiceDate
      ? new Date(dto.invoiceDate)
      : new Date(existing.invoiceDate);
    const fy = financialYear(invoiceDate, gstSettings.fyStartMonth);
    const sellerStateCode = gstSettings.stateCode;
    const partyStateCode = dto.partyStateCode ?? existing.partyStateCode ?? sellerStateCode;
    const interstate =
      partyStateCode.trim().toUpperCase() !==
      sellerStateCode.trim().toUpperCase();

    let taxableAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    const computedLines = dto.lines.map((line, idx) => {
      const gstRate = line.gstRate ?? Number(gstSettings.defaultGstRate);
      const split = computeLineGst({
        qty: line.qty,
        rate: line.rate,
        discount: line.discount,
        gstRate,
        interstate,
      });

      taxableAmount = round2(taxableAmount + split.taxableValue);
      cgstAmount = round2(cgstAmount + split.cgst);
      sgstAmount = round2(sgstAmount + split.sgst);
      igstAmount = round2(igstAmount + split.igst);

      return {
        lineNo: idx + 1,
        itemId: line.itemId,
        godownId: line.godownId,
        description: line.description,
        hsnSac: line.hsnSac,
        unit: line.unit ?? 'NOS',
        qty: line.qty,
        rate: line.rate,
        discount: line.discount ?? 0,
        taxableValue: split.taxableValue,
        gstRate,
        cgstAmount: split.cgst,
        sgstAmount: split.sgst,
        igstAmount: split.igst,
        lineTotal: split.lineTotal,
      };
    });

    const discountAmount = dto.discountAmount ?? Number(existing.discountAmount);
    const subtotal = round2(taxableAmount + cgstAmount + sgstAmount + igstAmount);
    const grandBeforeRound = round2(subtotal - discountAmount);
    const grandTotal = Math.round(grandBeforeRound);
    const roundOff = round2(grandTotal - grandBeforeRound);

    const paymentRows = (dto.payments ?? []).filter((p) => Number(p.amount) > 0);
    if (
      !paymentsWithinTotal(
        paymentRows.map((p) => ({ amount: p.amount })),
        grandTotal,
      )
    ) {
      const paid = round2(
        paymentRows.reduce((a, p) => a + Number(p.amount), 0),
      );
      throw new BadRequestException(
        `Payment total (${paid.toFixed(2)}) cannot exceed grand total (${grandTotal.toFixed(2)})`,
      );
    }
    const amountPaid = round2(
      paymentRows.reduce((a, p) => a + Number(p.amount), 0),
    );
    const balanceDue = round2(Math.max(0, grandTotal - amountPaid));
    const paymentStatus = paymentStatusFromAmounts(
      amountPaid,
      grandTotal,
    ) as PaymentStatus;
    const dueDate = dto.dueDate
      ? new Date(dto.dueDate)
      : balanceDue > 0.01
        ? existing.dueDate ??
          new Date(invoiceDate.getTime() + 7 * 24 * 60 * 60 * 1000)
        : null;

    const supplyType =
      dto.supplyType ??
      (dto.partyGstin ? SupplyType.B2B : SupplyType.B2C);

    const sellerAddress = [
      gstSettings.addressLine1,
      gstSettings.addressLine2,
      gstSettings.city,
      gstSettings.state,
      gstSettings.pincode,
    ]
      .filter(Boolean)
      .join(', ');

    const nextStatus =
      dto.finalize === false ? InvoiceStatus.DRAFT : InvoiceStatus.FINALIZED;

    if (nextStatus === InvoiceStatus.FINALIZED) {
      await this.inventory.assertSaleStock(
        actor.tenantId,
        computedLines.map((l) => ({
          itemId: l.itemId,
          qty: Number(l.qty),
          godownId: l.godownId,
        })),
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.invoicePayment.deleteMany({ where: { invoiceId: id } });
      await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });

      await tx.invoice.update({
        where: { id },
        data: {
          status: nextStatus,
          invoiceDate,
          fy,
          partyId: dto.partyId,
          partyName: dto.partyName,
          partyPhone: dto.partyPhone,
          partyAddress: dto.partyAddress,
          partyGstin: dto.partyGstin?.toUpperCase(),
          partyStateCode,
          partyExternalId: dto.partyExternalId,
          referredBy: dto.referredBy,
          placeOfSupply: dto.placeOfSupply ?? gstSettings.state,
          supplyType,
          reverseCharge: dto.reverseCharge ?? false,
          sellerGstin: gstSettings.gstin,
          sellerLegalName: gstSettings.legalName,
          sellerStateCode,
          sellerAddress,
          taxableAmount: dec(taxableAmount),
          cgstAmount: dec(cgstAmount),
          sgstAmount: dec(sgstAmount),
          igstAmount: dec(igstAmount),
          discountAmount: dec(discountAmount),
          grandTotal: dec(grandTotal),
          roundOff: dec(roundOff),
          amountPaid: dec(amountPaid),
          balanceDue: dec(balanceDue),
          paymentStatus,
          dueDate,
          settledAt: paymentStatus === PaymentStatus.PAID ? new Date() : null,
          notes: dto.notes,
          partyMeta: compactPartyMeta(dto.partyMeta),
          ...(nextStatus === InvoiceStatus.FINALIZED &&
          existing.status !== InvoiceStatus.FINALIZED
            ? { finalizedById: actor.userId, finalizedAt: new Date() }
            : {}),
          lines: {
            create: computedLines.map((l) => ({
              tenantId: actor.tenantId,
              lineNo: l.lineNo,
              itemId: l.itemId,
              godownId: l.godownId,
              description: l.description,
              hsnSac: l.hsnSac,
              unit: l.unit,
              qty: l.qty,
              rate: l.rate,
              discount: l.discount,
              taxableValue: dec(l.taxableValue),
              gstRate: l.gstRate,
              cgstAmount: dec(l.cgstAmount),
              sgstAmount: dec(l.sgstAmount),
              igstAmount: dec(l.igstAmount),
              cessAmount: dec(0),
              lineTotal: dec(l.lineTotal),
            })),
          },
          payments: {
            create: atBillingPayments(
              actor.tenantId,
              existing.billNo,
              grandTotal,
              actor.userId,
              paymentRows,
            ),
          },
        },
      });
    });

    await this.persistPartyDemographics(
      actor.tenantId,
      dto.partyId,
      dto.partyMeta,
    );

    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action:
        nextStatus === InvoiceStatus.FINALIZED
          ? 'INVOICE_FINALIZED'
          : 'INVOICE_DRAFT_UPDATED',
      entityType: 'Invoice',
      entityId: id,
      meta: { billNo: existing.billNo, grandTotal },
    });

    if (nextStatus === InvoiceStatus.FINALIZED) {
      await this.inventory.deductSale(
        actor.tenantId,
        computedLines.map((l) => ({
          itemId: l.itemId,
          qty: Number(l.qty),
          godownId: l.godownId,
        })),
        id,
        actor.userId,
      );
      await this.einvoice.processAfterCreate(id, actor.tenantId);
    }

    return this.get(actor.tenantId, id);
  }

  async addPayment(actor: AuthUser, invoiceId: string, dto: AddPaymentDto) {
    const amount = round2(Number(dto.amount));
    if (dto.mode === PaymentMode.UPI && !dto.upiRefId?.trim()) {
      throw new BadRequestException('UPI reference ID is required for UPI payments');
    }
    if (dto.mode === PaymentMode.CARD && !/^\d{4}$/.test(dto.cardLast4?.trim() ?? '')) {
      throw new BadRequestException('Card last 4 digits are required for card payments');
    }

    const now = new Date();
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : now;
    if (Number.isNaN(paidAt.getTime())) {
      throw new BadRequestException('Invalid payment date');
    }
    if (paidAt.getTime() > now.getTime() + 5 * 60 * 1000) {
      throw new BadRequestException('Payment date cannot be in the future');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Row lock so two cashiers cannot overpay the same bill concurrently.
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE`;
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, tenantId: actor.tenantId, deletedAt: null },
        include: { _count: { select: { payments: true } } },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.status !== InvoiceStatus.FINALIZED) {
        throw new BadRequestException(
          invoice.status === InvoiceStatus.VOID
            ? 'Cannot record payment on a void invoice'
            : 'Finalize the bill before recording payments against it',
        );
      }
      // invoiceDate is a calendar date; compare against the IST day of payment.
      if (istDateOf(paidAt) < invoice.invoiceDate.toISOString().slice(0, 10)) {
        throw new BadRequestException(
          'Payment date cannot be before the invoice date',
        );
      }

      const grand = Number(invoice.grandTotal);
      const balanceBefore = round2(Math.max(0, grand - Number(invoice.amountPaid)));
      if (balanceBefore <= 0.01) {
        throw new BadRequestException('This bill has no balance due');
      }
      if (amount > balanceBefore + 0.01) {
        throw new BadRequestException(
          `Payment ${amount.toFixed(2)} exceeds balance due ${balanceBefore.toFixed(2)}`,
        );
      }
      const nextPaid = round2(Number(invoice.amountPaid) + amount);
      const balanceDue = round2(Math.max(0, grand - nextPaid));
      const paymentStatus = paymentStatusFromAmounts(
        nextPaid,
        grand,
      ) as PaymentStatus;
      const receiptNo = `${invoice.billNo}/R${invoice._count.payments + 1}`;

      const payment = await tx.invoicePayment.create({
        data: {
          tenantId: actor.tenantId,
          invoiceId,
          mode: dto.mode,
          amount: dec(amount),
          upiRefId: dto.upiRefId?.trim() || null,
          cardLast4: dto.cardLast4?.trim() || null,
          notes: dto.notes?.trim() || null,
          paidAt,
          receiptNo,
          stage: PaymentStage.DUE_COLLECTION,
          balanceAfter: dec(balanceDue),
          receivedById: actor.userId,
        },
      });
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: dec(nextPaid),
          balanceDue: dec(balanceDue),
          paymentStatus,
          settledAt: paymentStatus === PaymentStatus.PAID ? paidAt : null,
        },
      });
      return {
        billNo: invoice.billNo,
        paymentId: payment.id,
        receiptNo,
        balanceBefore,
        balanceDue,
        paymentStatus,
      };
    });

    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action:
        result.paymentStatus === PaymentStatus.PAID
          ? 'INVOICE_DUE_SETTLED'
          : 'INVOICE_PAYMENT_ADDED',
      entityType: 'Invoice',
      entityId: invoiceId,
      meta: {
        billNo: result.billNo,
        receiptNo: result.receiptNo,
        paymentId: result.paymentId,
        amount,
        mode: dto.mode,
        upiRefId: dto.upiRefId,
        cardLast4: dto.cardLast4,
        paidAt: paidAt.toISOString(),
        balanceBefore: result.balanceBefore,
        balanceAfter: result.balanceDue,
      },
    });
    void this.hms.notifyHmsPayment(invoiceId, actor.tenantId);
    return this.get(actor.tenantId, invoiceId);
  }

  /**
   * Reverse a wrongly entered payment. The row is kept (marked reversed with
   * who/when/why) and the bill's paid total, balance and status are recomputed
   * from the remaining payments.
   */
  async reversePayment(
    actor: AuthUser,
    invoiceId: string,
    paymentId: string,
    reason: string,
  ) {
    const why = reason?.trim() ?? '';
    if (why.length < 3) {
      throw new BadRequestException('Give a reason for reversing this payment');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE`;
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, tenantId: actor.tenantId, deletedAt: null },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      if (invoice.status !== InvoiceStatus.FINALIZED) {
        throw new BadRequestException(
          'Payments can only be reversed on a finalized bill',
        );
      }
      const payment = await tx.invoicePayment.findFirst({
        where: { id: paymentId, invoiceId, tenantId: actor.tenantId },
      });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.reversedAt) {
        throw new BadRequestException('This payment is already reversed');
      }

      await tx.invoicePayment.update({
        where: { id: paymentId },
        data: {
          reversedAt: new Date(),
          reversedById: actor.userId,
          reversalReason: why,
        },
      });
      const totals = await this.recomputePaymentTotals(
        tx,
        invoiceId,
        Number(invoice.grandTotal),
      );
      return {
        billNo: invoice.billNo,
        payment,
        balanceBefore: Number(invoice.balanceDue),
        ...totals,
      };
    });

    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'INVOICE_PAYMENT_REVERSED',
      entityType: 'Invoice',
      entityId: invoiceId,
      meta: {
        billNo: result.billNo,
        receiptNo: result.payment.receiptNo,
        paymentId,
        amount: Number(result.payment.amount),
        mode: result.payment.mode,
        paidAt: result.payment.paidAt.toISOString(),
        reason: why,
        balanceBefore: result.balanceBefore,
        balanceAfter: result.balanceDue,
      },
    });
    void this.hms.notifyHmsPayment(invoiceId, actor.tenantId);
    return this.get(actor.tenantId, invoiceId);
  }

  /** Rebuild paid/balance/status and per-payment running balances from live payments. */
  private async recomputePaymentTotals(
    tx: Prisma.TransactionClient,
    invoiceId: string,
    grand: number,
  ) {
    const live = await tx.invoicePayment.findMany({
      where: { invoiceId, reversedAt: null },
      orderBy: [{ paidAt: 'asc' }, { createdAt: 'asc' }],
    });
    let paid = 0;
    for (const p of live) {
      paid = round2(paid + Number(p.amount));
      await tx.invoicePayment.update({
        where: { id: p.id },
        data: { balanceAfter: dec(Math.max(0, grand - paid)) },
      });
    }
    const balanceDue = round2(Math.max(0, grand - paid));
    const paymentStatus = paymentStatusFromAmounts(paid, grand) as PaymentStatus;
    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: dec(paid),
        balanceDue: dec(balanceDue),
        paymentStatus,
        settledAt:
          paymentStatus === PaymentStatus.PAID
            ? (live[live.length - 1]?.paidAt ?? new Date())
            : null,
      },
    });
    return { amountPaid: paid, balanceDue, paymentStatus };
  }

  createCreditNote(actor: AuthUser, dto: CreateNoteDto) {
    return this.billing
      .assertFeature(actor.tenantId, 'creditNotes', 'Credit notes')
      .then(() =>
        this.create(
          actor,
          dto,
          DocumentType.CREDIT_NOTE,
          dto.referenceInvoiceId,
        ),
      );
  }

  createDebitNote(actor: AuthUser, dto: CreateNoteDto) {
    return this.billing
      .assertFeature(actor.tenantId, 'creditNotes', 'Debit notes')
      .then(() =>
        this.create(
          actor,
          dto,
          DocumentType.DEBIT_NOTE,
          dto.referenceInvoiceId,
        ),
      );
  }

  list(tenantId: string, query: ListInvoicesQueryDto) {
    const where: Prisma.InvoiceWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status as InvoiceStatus;
    }
    if (query.paymentStatus) {
      where.paymentStatus = query.paymentStatus as PaymentStatus;
    }
    if (query.documentType) {
      where.documentType = query.documentType as DocumentType;
    }
    if (query.partyId) {
      where.partyId = query.partyId;
    }
    if (query.fy) {
      where.fy = query.fy;
    }
    if (query.from || query.to) {
      where.invoiceDate = {};
      if (query.from) {
        where.invoiceDate.gte = new Date(`${query.from}T00:00:00.000Z`);
      }
      if (query.to) {
        where.invoiceDate.lte = new Date(`${query.to}T23:59:59.999Z`);
      }
    }
    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { billNo: { contains: q, mode: 'insensitive' } },
        { partyName: { contains: q, mode: 'insensitive' } },
        { partyPhone: { contains: q, mode: 'insensitive' } },
        { partyGstin: { contains: q, mode: 'insensitive' } },
        { partyExternalId: { contains: q, mode: 'insensitive' } },
      ];
    }

    return this.prisma.invoice.findMany({
      where,
      orderBy: { invoiceDate: 'desc' },
      include: INVOICE_INCLUDE,
      take: 500,
    });
  }

  listRecycleBin(tenantId: string) {
    return this.prisma.invoice.findMany({
      where: {
        tenantId,
        deletedAt: { not: null },
      },
      orderBy: { deletedAt: 'desc' },
      include: INVOICE_INCLUDE,
    });
  }

  async get(tenantId: string, id: string, opts?: { includeDeleted?: boolean }) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        tenantId,
        ...(opts?.includeDeleted ? {} : { deletedAt: null }),
      },
      include: INVOICE_INCLUDE,
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async finalize(actor: AuthUser, id: string) {
    const invoice = await this.get(actor.tenantId, id);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only draft invoices can be finalized');
    }

    const saleLines = invoice.lines.map((l) => ({
      itemId: l.itemId ?? undefined,
      qty: Number(l.qty),
      godownId: l.godownId ?? undefined,
    }));

    if (invoice.documentType === DocumentType.TAX_INVOICE) {
      await this.inventory.assertSaleStock(actor.tenantId, saleLines);
    }

    await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.FINALIZED,
        finalizedById: actor.userId,
        finalizedAt: new Date(),
      },
    });

    if (invoice.documentType === DocumentType.TAX_INVOICE) {
      await this.inventory.deductSale(
        actor.tenantId,
        saleLines,
        id,
        actor.userId,
      );
    }

    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'INVOICE_FINALIZED',
      entityType: 'Invoice',
      entityId: id,
    });

    await this.einvoice.processAfterCreate(id, actor.tenantId);
    return this.get(actor.tenantId, id);
  }

  async voidInvoice(actor: AuthUser, id: string, reason: string) {
    const invoice = await this.get(actor.tenantId, id);
    if (invoice.status === InvoiceStatus.VOID) {
      throw new BadRequestException('Invoice already void');
    }

    await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.VOID,
        voidedAt: new Date(),
        voidReason: reason,
        voidedById: actor.userId,
      },
    });

    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'INVOICE_VOIDED',
      entityType: 'Invoice',
      entityId: id,
      meta: { reason },
    });

    return this.get(actor.tenantId, id);
  }

  async softDelete(actor: AuthUser, id: string) {
    const invoice = await this.get(actor.tenantId, id);
    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'INVOICE_SOFT_DELETED',
      entityType: 'Invoice',
      entityId: id,
      meta: { billNo: invoice.billNo },
    });

    return { ok: true };
  }

  async restore(actor: AuthUser, id: string) {
    const invoice = await this.get(actor.tenantId, id, { includeDeleted: true });
    if (!invoice.deletedAt) {
      throw new BadRequestException('Invoice is not in the recycle bin');
    }

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { deletedAt: null },
    });

    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'INVOICE_RESTORED',
      entityType: 'Invoice',
      entityId: id,
      meta: { billNo: invoice.billNo },
    });

    return this.get(actor.tenantId, id);
  }

  async permanentDelete(actor: AuthUser, id: string) {
    if (actor.role !== UserRole.CLIENT_ADMIN) {
      throw new ForbiddenException('Only the Owner can permanently delete bills');
    }

    const invoice = await this.get(actor.tenantId, id, { includeDeleted: true });
    if (!invoice.deletedAt) {
      throw new BadRequestException(
        'Move the bill to the recycle bin before permanently deleting it',
      );
    }

    await this.prisma.invoice.delete({ where: { id: invoice.id } });

    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'INVOICE_PERMANENTLY_DELETED',
      entityType: 'Invoice',
      entityId: id,
      meta: { billNo: invoice.billNo },
    });

    return { ok: true };
  }

  async emptyRecycleBin(actor: AuthUser) {
    if (actor.role !== UserRole.CLIENT_ADMIN) {
      throw new ForbiddenException('Only the Owner can empty the recycle bin');
    }

    const result = await this.prisma.invoice.deleteMany({
      where: {
        tenantId: actor.tenantId,
        deletedAt: { not: null },
      },
    });

    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'INVOICE_BIN_EMPTIED',
      entityType: 'Invoice',
      meta: { count: result.count },
    });

    return { ok: true, count: result.count };
  }

  async print(actor: AuthUser, id: string, format?: string) {
    const tenantId = actor.tenantId;
    const printData = await this.loadPrintData(tenantId, id);
    const dbUser = await this.prisma.user.findUnique({
      where: { id: actor.userId },
      select: {
        preferredPrintFormat: true,
        preferredInvoiceTheme: true,
      },
    });

    const brandFormat = (
      printData.brand as { printFormat?: string }
    ).printFormat;
    const printFormat = normalizePrintFormat(
      format || dbUser?.preferredPrintFormat || brandFormat,
    );

    if (dbUser?.preferredInvoiceTheme) {
      (printData.brand as { invoiceTheme?: string }).invoiceTheme =
        dbUser.preferredInvoiceTheme;
    }

    const html = await this.pdf.buildInvoiceHtml(printData, printFormat);

    try {
      const result = await this.pdf.generateInvoicePdf(
        printData,
        tenantId,
        html,
        printFormat,
      );
      const publicPath =
        result.publicPath ?? this.storage.getPublicPath(result.gcsKey);

      return {
        html,
        printFormat,
        gcsKey: result.gcsKey,
        publicPath: publicPath ?? undefined,
        signedUrl: result.signedUrl,
      };
    } catch (err) {
      // HTML preview still works if Chromium/PDF storage fails.
      this.logger.warn(
        `PDF generation failed for invoice ${id}; returning HTML only: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return { html, printFormat };
    }
  }

  async shareEmail(actor: AuthUser, id: string, dto: ShareEmailDto) {
    const invoice = await this.get(actor.tenantId, id);
    const { pdfBuffer, filename } = await this.ensurePdfBuffer(
      actor.tenantId,
      invoice,
    );

    const defaultText = `Please find invoice ${invoice.billNo} attached (total ${Number(invoice.grandTotal).toFixed(2)}).`;
    const text = dto.message?.trim() || defaultText;

    await this.integrations.sendInvoiceEmail({
      tenantId: actor.tenantId,
      to: dto.to,
      subject: `Invoice ${invoice.billNo}`,
      text,
      html: `<p>${text.replace(/\n/g, '<br/>')}</p>`,
      filename,
      pdfBuffer,
    });

    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'INVOICE_SHARED_EMAIL',
      entityType: 'Invoice',
      entityId: id,
      meta: { to: dto.to, billNo: invoice.billNo },
    });

    return { ok: true, channel: 'email', to: dto.to, billNo: invoice.billNo };
  }

  async shareWhatsapp(actor: AuthUser, id: string, dto: ShareWhatsappDto) {
    await this.billing.assertFeature(
      actor.tenantId,
      'whatsapp',
      'WhatsApp share',
    );
    const invoice = await this.get(actor.tenantId, id);
    const { pdfBuffer, filename } = await this.ensurePdfBuffer(
      actor.tenantId,
      invoice,
    );

    const defaultCaption = `Invoice ${invoice.billNo} — total ${Number(invoice.grandTotal).toFixed(2)}`;
    const caption = dto.message?.trim() || defaultCaption;

    await this.integrations.sendWhatsappDocument({
      tenantId: actor.tenantId,
      toE164: dto.toE164,
      caption,
      filename,
      pdfBuffer,
    });

    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'INVOICE_SHARED_WHATSAPP',
      entityType: 'Invoice',
      entityId: id,
      meta: { toE164: dto.toE164, billNo: invoice.billNo },
    });

    return {
      ok: true,
      channel: 'whatsapp',
      toE164: dto.toE164,
      billNo: invoice.billNo,
    };
  }

  private async ensurePdfBuffer(
    tenantId: string,
    invoice: { id: string; billNo: string; pdfGcsKey: string | null },
  ): Promise<{ pdfBuffer: Buffer; filename: string }> {
    const filename = `${invoice.billNo}.pdf`;

    if (invoice.pdfGcsKey) {
      try {
        const pdfBuffer = await this.storage.downloadBuffer(invoice.pdfGcsKey);
        return { pdfBuffer, filename };
      } catch (err) {
        this.logger.warn(
          `Existing PDF missing for invoice ${invoice.id}; regenerating: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const printData = await this.loadPrintData(tenantId, invoice.id);
    const html = await this.pdf.buildInvoiceHtml(printData);
    const result = await this.pdf.generateInvoicePdf(
      printData,
      tenantId,
      html,
    );
    const pdfBuffer = await this.storage.downloadBuffer(result.gcsKey);
    return { pdfBuffer, filename };
  }

  private async loadPrintData(
    tenantId: string,
    id: string,
  ): Promise<InvoicePrintData> {
    const invoice = await this.get(tenantId, id);
    const [brand, gst] = await Promise.all([
      this.prisma.brandTemplate.findUnique({ where: { tenantId } }),
      this.prisma.gstSettings.findUnique({ where: { tenantId } }),
    ]);

    if (!brand) {
      throw new NotFoundException('Brand template not found');
    }

    return {
      ...invoice,
      // Reversed entries stay in the ledger but never print as payments.
      payments: invoice.payments.filter((p) => !p.reversedAt),
      brand,
      gst,
    };
  }

  private async persistPartyDemographics(
    tenantId: string,
    partyId: string | undefined,
    meta: Record<string, unknown> | undefined,
  ) {
    const compact = compactPartyMeta(meta);
    if (!partyId || !Object.keys(compact).length) return;
    const party = await this.prisma.party.findFirst({
      where: { id: partyId, tenantId },
    });
    if (!party) return;
    const existing =
      party.customFields && typeof party.customFields === 'object'
        ? (party.customFields as Record<string, unknown>)
        : {};
    await this.prisma.party.update({
      where: { id: partyId },
      data: {
        customFields: { ...existing, ...compact } as Prisma.InputJsonValue,
      },
    });
  }
}

function normalizePrintFormat(
  raw?: string | null,
): 'A4' | 'THERMAL_80' | 'THERMAL_58' {
  const v = (raw ?? 'A4').toString().toUpperCase();
  if (v === 'THERMAL_80' || v === '80' || v === 'THERMAL80') return 'THERMAL_80';
  if (v === 'THERMAL_58' || v === '58' || v === 'THERMAL58') return 'THERMAL_58';
  return 'A4';
}
