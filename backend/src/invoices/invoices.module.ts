import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { GstModule } from '../gst/gst.module';
import { AuditModule } from '../audit/audit.module';
import { PdfModule } from '../pdf/pdf.module';
import { EinvoiceModule } from '../einvoice/einvoice.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { BillingModule } from '../billing/billing.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    GstModule,
    AuditModule,
    PdfModule,
    EinvoiceModule,
    IntegrationsModule,
    BillingModule,
    InventoryModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
