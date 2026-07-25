import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EwayStatus, InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { BillingService } from '../billing/billing.service';
import { CreateEwayDto } from './dto/eway.dto';
import { EwayProvider } from './eway.provider';
import { StubEwayProvider } from './stub-eway.provider';
import { HttpEwayProvider } from './http-eway.provider';

@Injectable()
export class EwayService {
  private readonly provider: EwayProvider;

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    stub: StubEwayProvider,
    http: HttpEwayProvider,
  ) {
    const mode = (process.env.EWAY_PROVIDER ?? 'stub').toLowerCase();
    this.provider = mode === 'http' ? http : stub;
  }

  list(tenantId: string) {
    return this.prisma.ewayBill.findMany({
      where: { tenantId },
      include: {
        invoice: {
          select: {
            id: true,
            billNo: true,
            partyName: true,
            grandTotal: true,
            invoiceDate: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async get(tenantId: string, id: string) {
    const row = await this.prisma.ewayBill.findFirst({
      where: { id, tenantId },
      include: {
        invoice: {
          select: {
            id: true,
            billNo: true,
            partyName: true,
            grandTotal: true,
            invoiceDate: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException('E-way bill not found');
    return row;
  }

  async create(actor: AuthUser, dto: CreateEwayDto) {
    await this.billing.assertFeature(actor.tenantId, 'eway', 'E-way bills');
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: dto.invoiceId, tenantId: actor.tenantId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== InvoiceStatus.FINALIZED) {
      throw new BadRequestException('Invoice must be finalized');
    }

    const draft = await this.prisma.ewayBill.create({
      data: {
        tenantId: actor.tenantId,
        invoiceId: invoice.id,
        status: EwayStatus.DRAFT,
        vehicleNo: dto.vehicleNo,
        transporter: dto.transporterName ?? dto.transporterId,
        fromPlace: dto.fromPlace,
        toPlace: dto.toPlace,
        distanceKm: dto.distanceKm,
        createdById: actor.userId,
      },
    });

    try {
      const result = await this.provider.generate({
        invoiceId: invoice.id,
        billNo: invoice.billNo,
        invoiceDate: invoice.invoiceDate,
        partyName: invoice.partyName,
        partyGstin: invoice.partyGstin,
        sellerGstin: invoice.sellerGstin,
        documentValue: dto.documentValue ?? Number(invoice.grandTotal),
        fromPlace: dto.fromPlace,
        toPlace: dto.toPlace,
        transporterName: dto.transporterName,
        transporterId: dto.transporterId,
        vehicleNo: dto.vehicleNo,
        distanceKm: dto.distanceKm,
      });

      return this.prisma.ewayBill.update({
        where: { id: draft.id },
        data: {
          status: EwayStatus.GENERATED,
          ewbNo: result.ewbNo,
          validUntil: result.validUntil,
          payload: {
            provider: result.provider,
            ...(result.payload ?? {}),
          } as Prisma.InputJsonValue,
        },
        include: {
          invoice: {
            select: {
              id: true,
              billNo: true,
              partyName: true,
              grandTotal: true,
            },
          },
        },
      });
    } catch (err) {
      await this.prisma.ewayBill.update({
        where: { id: draft.id },
        data: {
          status: EwayStatus.FAILED,
          payload: {
            error: err instanceof Error ? err.message : 'E-way failed',
          } as Prisma.InputJsonValue,
        },
      });
      throw new BadRequestException(
        err instanceof Error ? err.message : 'E-way generation failed',
      );
    }
  }

  async cancel(tenantId: string, id: string, reason?: string) {
    await this.billing.assertFeature(tenantId, 'eway', 'E-way bills');
    const row = await this.get(tenantId, id);
    if (row.status === EwayStatus.CANCELLED) {
      throw new BadRequestException('Already cancelled');
    }
    return this.prisma.ewayBill.update({
      where: { id },
      data: {
        status: EwayStatus.CANCELLED,
        cancelReason: reason ?? 'Cancelled by user',
      },
    });
  }
}
