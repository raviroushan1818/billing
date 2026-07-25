import { Module } from '@nestjs/common';
import { EinvoiceService } from './einvoice.service';
import { NullEinvoiceProvider } from './null-einvoice.provider';
import { HttpEinvoiceProvider } from './http-einvoice.provider';

@Module({
  providers: [EinvoiceService, NullEinvoiceProvider, HttpEinvoiceProvider],
  exports: [EinvoiceService],
})
export class EinvoiceModule {}
