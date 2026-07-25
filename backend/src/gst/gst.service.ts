import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertGstSettingsDto } from './dto/gst.dto';

@Injectable()
export class GstService {
  constructor(private readonly prisma: PrismaService) {}

  get(tenantId: string) {
    return this.prisma.gstSettings.findUnique({
      where: { tenantId },
    });
  }

  upsert(tenantId: string, dto: UpsertGstSettingsDto) {
    return this.prisma.gstSettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        gstin: dto.gstin?.toUpperCase(),
        legalName: dto.legalName,
        tradeName: dto.tradeName,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        stateCode: dto.stateCode,
        pincode: dto.pincode,
        email: dto.email,
        phone: dto.phone,
        fyStartMonth: dto.fyStartMonth ?? 4,
        defaultGstRate: dto.defaultGstRate ?? 18,
        eInvoiceEnabled: dto.eInvoiceEnabled ?? false,
        eInvoiceThreshold: dto.eInvoiceThreshold ?? 0,
      },
      update: {
        gstin: dto.gstin?.toUpperCase(),
        legalName: dto.legalName,
        tradeName: dto.tradeName,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        state: dto.state,
        stateCode: dto.stateCode,
        pincode: dto.pincode,
        email: dto.email,
        phone: dto.phone,
        fyStartMonth: dto.fyStartMonth,
        defaultGstRate: dto.defaultGstRate,
        eInvoiceEnabled: dto.eInvoiceEnabled,
        eInvoiceThreshold: dto.eInvoiceThreshold,
      },
    });
  }
}
