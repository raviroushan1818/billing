import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { PlatformModule } from './platform/platform.module';
import { TenantsModule } from './tenants/tenants.module';
import { PartiesModule } from './parties/parties.module';
import { ItemsModule } from './items/items.module';
import { GstModule } from './gst/gst.module';
import { InvoicesModule } from './invoices/invoices.module';
import { BrandingModule } from './branding/branding.module';
import { StorageModule } from './storage/storage.module';
import { PdfModule } from './pdf/pdf.module';
import { EinvoiceModule } from './einvoice/einvoice.module';
import { ReportsModule } from './reports/reports.module';
import { AuditModule } from './audit/audit.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { PublicModule } from './public/public.module';
import { BillingModule } from './billing/billing.module';
import { NotesModule } from './notes/notes.module';
import { InventoryModule } from './inventory/inventory.module';
import { PurchasesModule } from './purchases/purchases.module';
import { EwayModule } from './eway/eway.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    AuthModule,
    PlatformModule,
    TenantsModule,
    PartiesModule,
    ItemsModule,
    GstModule,
    InvoicesModule,
    BrandingModule,
    StorageModule,
    PdfModule,
    EinvoiceModule,
    ReportsModule,
    AuditModule,
    IntegrationsModule,
    PublicModule,
    BillingModule,
    NotesModule,
    InventoryModule,
    PurchasesModule,
    EwayModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
