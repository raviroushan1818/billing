import { Invoice, InvoiceLine, InvoicePayment, BrandTemplate, GstSettings } from '@prisma/client';

export type InvoicePrintData = Invoice & {
  lines: InvoiceLine[];
  payments: InvoicePayment[];
  brand: BrandTemplate;
  gst: GstSettings | null;
};

export type EinvoicePushResult = {
  irn?: string;
  ackNo?: string;
  ackDate?: Date;
  signedQr?: string;
  payload?: Record<string, unknown>;
};

export interface EinvoiceProvider {
  push(invoice: InvoicePrintData): Promise<EinvoicePushResult>;
}

export const EINVOICE_PROVIDER = Symbol('EINVOICE_PROVIDER');
