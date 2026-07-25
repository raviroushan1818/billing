import { Injectable, Logger } from '@nestjs/common';
import {
  EinvoiceProvider,
  EinvoicePushResult,
  InvoicePrintData,
} from './einvoice.provider';

/**
 * HTTP GSP/IRP bridge. Set EINVOICE_PROVIDER=http and:
 *   EINVOICE_API_URL, EINVOICE_API_KEY (optional Authorization bearer)
 * Falls back to mock-style failure if misconfigured at call time.
 */
@Injectable()
export class HttpEinvoiceProvider implements EinvoiceProvider {
  private readonly logger = new Logger(HttpEinvoiceProvider.name);

  async push(invoice: InvoicePrintData): Promise<EinvoicePushResult> {
    const url = process.env.EINVOICE_API_URL?.trim();
    if (!url) {
      throw new Error('EINVOICE_API_URL is not configured');
    }
    const key = process.env.EINVOICE_API_KEY?.trim();
    const body = {
      billNo: invoice.billNo,
      invoiceDate: invoice.invoiceDate,
      sellerGstin: invoice.sellerGstin,
      sellerLegalName: invoice.sellerLegalName,
      sellerStateCode: invoice.sellerStateCode,
      partyName: invoice.partyName,
      partyGstin: invoice.partyGstin,
      partyStateCode: invoice.partyStateCode,
      taxableAmount: Number(invoice.taxableAmount),
      cgstAmount: Number(invoice.cgstAmount),
      sgstAmount: Number(invoice.sgstAmount),
      igstAmount: Number(invoice.igstAmount),
      grandTotal: Number(invoice.grandTotal),
      lines: invoice.lines.map((l) => ({
        description: l.description,
        hsnSac: l.hsnSac,
        qty: Number(l.qty),
        rate: Number(l.rate),
        taxableValue: Number(l.taxableValue),
        gstRate: Number(l.gstRate),
      })),
    };
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (key) headers.Authorization = `Bearer ${key}`;

    this.logger.log(`Pushing e-invoice ${invoice.billNo} to GSP`);
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = { raw: text };
    }
    if (!res.ok) {
      throw new Error(
        `E-invoice provider error ${res.status}: ${text.slice(0, 300)}`,
      );
    }
    return {
      irn: typeof json.irn === 'string' ? json.irn : undefined,
      ackNo: typeof json.ackNo === 'string' ? json.ackNo : undefined,
      ackDate: json.ackDate ? new Date(String(json.ackDate)) : undefined,
      signedQr: typeof json.signedQr === 'string' ? json.signedQr : undefined,
      payload: json,
    };
  }
}
