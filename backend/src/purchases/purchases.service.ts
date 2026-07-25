import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PurchaseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { financialYear } from '../common/gst.util';
import { CreatePurchaseDto } from './dto/purchase.dto';
import { GstService } from '../gst/gst.service';
import { BillingService } from '../billing/billing.service';

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function dec(n: number) {
  return new Prisma.Decimal(n.toFixed(2));
}

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly gst: GstService,
    private readonly billing: BillingService,
  ) {}

  list(tenantId: string) {
    return this.prisma.purchaseBill.findMany({
      where: { tenantId },
      include: { lines: true, godown: true },
      orderBy: { billDate: 'desc' },
      take: 200,
    });
  }

  async get(tenantId: string, id: string) {
    const row = await this.prisma.purchaseBill.findFirst({
      where: { id, tenantId },
      include: { lines: { orderBy: { lineNo: 'asc' } }, godown: true },
    });
    if (!row) throw new NotFoundException('Purchase not found');
    return row;
  }

  async create(actor: AuthUser, dto: CreatePurchaseDto) {
    await this.billing.assertFeature(actor.tenantId, 'stock', 'Purchases / stock');
    const gstSettings = await this.gst.get(actor.tenantId);
    const billDate = dto.billDate ? new Date(dto.billDate) : new Date();
    const fy = financialYear(billDate, gstSettings?.fyStartMonth ?? 4);
    const interstate = Boolean(dto.interstate);

    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    const lines = dto.lines.map((l, idx) => {
      const gstRate = l.gstRate ?? 18;
      const taxableValue = round2(l.qty * l.rate);
      const tax = round2((taxableValue * gstRate) / 100);
      taxable = round2(taxable + taxableValue);
      let lineCgst = 0;
      let lineSgst = 0;
      let lineIgst = 0;
      if (interstate) {
        lineIgst = tax;
        igst = round2(igst + tax);
      } else {
        lineCgst = round2(tax / 2);
        lineSgst = round2(tax - lineCgst);
        cgst = round2(cgst + lineCgst);
        sgst = round2(sgst + lineSgst);
      }
      return {
        lineNo: idx + 1,
        itemId: l.itemId,
        description: l.description,
        hsnSac: l.hsnSac,
        unit: l.unit ?? 'NOS',
        qty: l.qty,
        rate: l.rate,
        gstRate,
        taxableValue,
        cgstAmount: lineCgst,
        sgstAmount: lineSgst,
        igstAmount: lineIgst,
        lineTotal: round2(taxableValue + tax),
      };
    });
    const grandTotal = Math.round(taxable + cgst + sgst + igst);
    const vendorGstin = dto.vendorGstin?.trim().toUpperCase() || undefined;
    const itcEligible = Boolean(vendorGstin && vendorGstin.length >= 15);
    const itcCgst = itcEligible ? cgst : 0;
    const itcSgst = itcEligible ? sgst : 0;
    const itcIgst = itcEligible ? igst : 0;

    const billNo = await this.nextBillNo(actor.tenantId, fy);
    const created = await this.prisma.purchaseBill.create({
      data: {
        tenantId: actor.tenantId,
        billNo,
        status: PurchaseStatus.FINALIZED,
        billDate,
        fy,
        vendorId: dto.vendorId,
        vendorName: dto.vendorName,
        vendorGstin,
        vendorPhone: dto.vendorPhone,
        godownId: dto.godownId,
        taxableAmount: dec(taxable),
        cgstAmount: dec(cgst),
        sgstAmount: dec(sgst),
        igstAmount: dec(igst),
        grandTotal: dec(grandTotal),
        itcEligible,
        itcCgst: dec(itcCgst),
        itcSgst: dec(itcSgst),
        itcIgst: dec(itcIgst),
        itcNotes: itcEligible
          ? 'Auto-marked eligible (vendor GSTIN present)'
          : 'No vendor GSTIN — ITC not claimed',
        notes: dto.notes,
        createdById: actor.userId,
        lines: {
          create: lines.map((l) => ({
            tenantId: actor.tenantId,
            lineNo: l.lineNo,
            itemId: l.itemId,
            description: l.description,
            hsnSac: l.hsnSac,
            unit: l.unit,
            qty: l.qty,
            rate: l.rate,
            gstRate: l.gstRate,
            taxableValue: dec(l.taxableValue),
            cgstAmount: dec(l.cgstAmount),
            sgstAmount: dec(l.sgstAmount),
            igstAmount: dec(l.igstAmount),
            lineTotal: dec(l.lineTotal),
          })),
        },
      },
      include: { lines: true },
    });

    await this.inventory.addPurchaseStock(
      actor.tenantId,
      dto.godownId,
      lines.map((l) => ({ itemId: l.itemId, qty: Number(l.qty) })),
      created.id,
      actor.userId,
    );

    return this.get(actor.tenantId, created.id);
  }

  private async nextBillNo(tenantId: string, fy: string) {
    const prefix = 'PUR';
    const key = { tenantId, fy, prefix };
    const existing = await this.prisma.invoiceSequence.findUnique({
      where: { tenantId_fy_prefix: key },
    });
    let n: number;
    if (!existing) {
      await this.prisma.invoiceSequence.create({
        data: { ...key, nextNo: 2 },
      });
      n = 1;
    } else {
      n = existing.nextNo;
      await this.prisma.invoiceSequence.update({
        where: { id: existing.id },
        data: { nextNo: existing.nextNo + 1 },
      });
    }
    return `${prefix}-${fy.replace('-', '')}-${String(n).padStart(4, '0')}`;
  }

  async void(tenantId: string, id: string) {
    const row = await this.get(tenantId, id);
    if (row.status === PurchaseStatus.VOID) {
      throw new BadRequestException('Already void');
    }
    return this.prisma.purchaseBill.update({
      where: { id },
      data: { status: PurchaseStatus.VOID },
    });
  }
}
