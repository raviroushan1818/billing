import { Module, forwardRef } from '@nestjs/common';
import { HmsController } from './hms.controller';
import { HmsService } from './hms.service';
import { HmsApiKeyGuard } from './hms-api-key.guard';
import { AuthModule } from '../auth/auth.module';
import { InvoicesModule } from '../invoices/invoices.module';

@Module({
  imports: [AuthModule, forwardRef(() => InvoicesModule)],
  controllers: [HmsController],
  providers: [HmsService, HmsApiKeyGuard],
  exports: [HmsService],
})
export class HmsModule {}
