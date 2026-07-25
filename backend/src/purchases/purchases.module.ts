import { Module } from '@nestjs/common';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { InventoryModule } from '../inventory/inventory.module';
import { GstModule } from '../gst/gst.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [InventoryModule, GstModule, BillingModule],
  controllers: [PurchasesController],
  providers: [PurchasesService],
  exports: [PurchasesService],
})
export class PurchasesModule {}
