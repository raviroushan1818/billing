import { Injectable } from '@nestjs/common';
import {
  EinvoiceProvider,
  InvoicePrintData,
} from './einvoice.provider';
import { NullEinvoiceProvider } from './null-einvoice.provider';
import { HttpEinvoiceProvider } from './http-einvoice.provider';
import { PrismaService } from '../prisma/prisma.service';
import {
  DocumentType,
  EinvoiceStatus,
  InvoiceStatus,
  Prisma,
  SupplyType,
} from '@prisma/client';

@Injectable()
export class EinvoiceService {
  private readonly provider: EinvoiceProvider;

  constructor(
    private readonly prisma: PrismaService,
    nullProvider: NullEinvoiceProvider,
    httpProvider: HttpEinvoiceProvider,
  ) {
    const mode = (process.env.EINVOICE_PROVIDER ?? 'null').toLowerCase();
    this.provider = mode === 'http' ? httpProvider : nullProvider;
  }

  shouldApplyEinvoice(
    gst: {
      eInvoiceEnabled: boolean;
      eInvoiceThreshold: { toNumber(): number };
    } | null,
    invoice: {
      supplyType: SupplyType;
      partyGstin: string | null;
      grandTotal: { toNumber(): number };
    },
  ): boolean {
    if (!gst?.eInvoiceEnabled) return false;
    if (invoice.supplyType !== SupplyType.B2B) return false;
    if (!invoice.partyGstin) return false;
    const threshold = Number(gst.eInvoiceThreshold);
    if (threshold > 0 && Number(invoice.grandTotal) < threshold) return false;
    return true;
  }

  async processAfterCreate(invoiceId: string, tenantId: string) {
    const data = await this.loadPrintData(invoiceId, tenantId);
    if (!data || data.status !== InvoiceStatus.FINALIZED) return data;

    if (
      !this.shouldApplyEinvoice(data.gst, {
        supplyType: data.supplyType,
        partyGstin: data.partyGstin,
        grandTotal: data.grandTotal,
      })
    ) {
      return data;
    }

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { einvoiceStatus: EinvoiceStatus.PENDING },
    });

    try {
      const result = await this.provider.push(data);
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          einvoiceStatus: EinvoiceStatus.PUSHED,
          irn: result.irn,
          ackNo: result.ackNo,
          ackDate: result.ackDate,
          signedQr: result.signedQr,
          einvoicePayload: result.payload as Prisma.InputJsonValue,
        },
      });
    } catch {
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { einvoiceStatus: EinvoiceStatus.FAILED },
      });
    }

    return this.loadPrintData(invoiceId, tenantId);
  }

  private async loadPrintData(
    invoiceId: string,
    tenantId: string,
  ): Promise<InvoicePrintData | null> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: {
        lines: { orderBy: { lineNo: 'asc' } },
        payments: true,
      },
    });
    if (!invoice) return null;

    const [brand, gst] = await Promise.all([
      this.prisma.brandTemplate.findUnique({ where: { tenantId } }),
      this.prisma.gstSettings.findUnique({ where: { tenantId } }),
    ]);

    if (!brand) return null;

    return {
      ...invoice,
      brand,
      gst,
    };
  }

  buildPayload(data: InvoicePrintData): Record<string, unknown> {
    return {
      documentType: data.documentType as DocumentType,
      billNo: data.billNo,
      invoiceDate: data.invoiceDate,
      seller: {
        gstin: data.sellerGstin,
        legalName: data.sellerLegalName,
        stateCode: data.sellerStateCode,
      },
      buyer: {
        name: data.partyName,
        gstin: data.partyGstin,
        stateCode: data.partyStateCode,
      },
      totals: {
        taxable: Number(data.taxableAmount),
        cgst: Number(data.cgstAmount),
        sgst: Number(data.sgstAmount),
        igst: Number(data.igstAmount),
        grandTotal: Number(data.grandTotal),
      },
      lines: data.lines.map((l) => ({
        description: l.description,
        hsnSac: l.hsnSac,
        qty: Number(l.qty),
        rate: Number(l.rate),
        taxableValue: Number(l.taxableValue),
        gstRate: Number(l.gstRate),
      })),
    };
  }
}
