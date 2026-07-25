import { Module } from '@nestjs/common';
import { EwayController } from './eway.controller';
import { EwayService } from './eway.service';
import { BillingModule } from '../billing/billing.module';
import { StubEwayProvider } from './stub-eway.provider';
import { HttpEwayProvider } from './http-eway.provider';

@Module({
  imports: [BillingModule],
  controllers: [EwayController],
  providers: [EwayService, StubEwayProvider, HttpEwayProvider],
  exports: [EwayService],
})
export class EwayModule {}
