import { Injectable } from '@nestjs/common';
import {
  EinvoiceProvider,
  EinvoicePushResult,
  InvoicePrintData,
} from './einvoice.provider';

@Injectable()
export class NullEinvoiceProvider implements EinvoiceProvider {
  async push(invoice: InvoicePrintData): Promise<EinvoicePushResult> {
    return {
      payload: {
        status: 'MOCK',
        billNo: invoice.billNo,
        grandTotal: Number(invoice.grandTotal),
        partyGstin: invoice.partyGstin,
      },
    };
  }
}
