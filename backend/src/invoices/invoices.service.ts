import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentType,
  EinvoiceStatus,
  InvoiceStatus,
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

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function dec(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(2));
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
  payments: true,
  createdBy: { select: ACTOR_SELECT },
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
          notes: dto.notes,
          createdById: actor.userId,
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
            create: paymentRows.map((p) => ({
              tenantId: actor.tenantId,
              mode: p.mode,
              amount: dec(p.amount),
              upiRefId: p.upiRefId,
              cardLast4: p.cardLast4,
              notes: p.notes,
            })),
          },
        },
        include: {
          lines: { orderBy: { lineNo: 'asc' } },
          payments: true,
        },
      });

      return created;
    });

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
          notes: dto.notes,
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
            create: paymentRows.map((p) => ({
              tenantId: actor.tenantId,
              mode: p.mode,
              amount: dec(p.amount),
              upiRefId: p.upiRefId,
              cardLast4: p.cardLast4,
              notes: p.notes,
            })),
          },
        },
      });
    });

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
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId: actor.tenantId, deletedAt: null },
      include: { payments: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.VOID) {
      throw new BadRequestException('Cannot pay a void invoice');
    }
    const grand = Number(invoice.grandTotal);
    const already = Number(invoice.amountPaid);
    const nextPaid = round2(already + Number(dto.amount));
    if (nextPaid > grand + 0.01) {
      throw new BadRequestException(
        `Payment would exceed balance (due ${round2(grand - already).toFixed(2)})`,
      );
    }
    await this.prisma.invoicePayment.create({
      data: {
        tenantId: actor.tenantId,
        invoiceId,
        mode: dto.mode,
        amount: dec(dto.amount),
        upiRefId: dto.upiRefId,
        cardLast4: dto.cardLast4,
        notes: dto.notes,
      },
    });
    const balanceDue = round2(Math.max(0, grand - nextPaid));
    const paymentStatus = paymentStatusFromAmounts(
      nextPaid,
      grand,
    ) as PaymentStatus;
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: dec(nextPaid),
        balanceDue: dec(balanceDue),
        paymentStatus,
      },
    });
    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'INVOICE_PAYMENT_ADDED',
      entityType: 'Invoice',
      entityId: invoiceId,
      meta: { amount: dto.amount, mode: dto.mode },
    });
    return this.get(actor.tenantId, invoiceId);
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
      data: { status: InvoiceStatus.FINALIZED },
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

  async print(tenantId: string, id: string) {
    const printData = await this.loadPrintData(tenantId, id);
    const html = await this.pdf.buildInvoiceHtml(printData);

    try {
      const result = await this.pdf.generateInvoicePdf(
        printData,
        tenantId,
        html,
      );
      const publicPath =
        result.publicPath ?? this.storage.getPublicPath(result.gcsKey);

      return {
        html,
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
      return { html };
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
      brand,
      gst,
    };
  }
}
