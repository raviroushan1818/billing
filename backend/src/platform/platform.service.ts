import { randomBytes } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantStatus, UserRole, BusinessProfile } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PROFILE_DEFAULTS } from '../common/constants';
import { CreateTenantAdminDto, CreateTenantDto } from './dto/platform.dto';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { BillingService } from '../billing/billing.service';

function generateClientId(): string {
  const suffix = randomBytes(4).toString('hex').toUpperCase();
  return `CLI-${suffix}`;
}

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
  ) {}

  async createTenant(actor: AuthUser, dto: CreateTenantDto) {
    let clientId = generateClientId();
    for (let i = 0; i < 5; i++) {
      const exists = await this.prisma.tenant.findUnique({
        where: { clientId },
      });
      if (!exists) break;
      clientId = generateClientId();
    }

    const defaults =
      PROFILE_DEFAULTS[dto.profileType] ?? PROFILE_DEFAULTS.GENERIC;

    const tenant = await this.prisma.tenant.create({
      data: {
        clientId,
        name: dto.name,
        legalName: dto.legalName,
        profileType: dto.profileType,
        status: TenantStatus.TRIAL,
        planCode: dto.planCode ?? 'GROWTH',
        maxUsers: dto.maxUsers ?? 5,
        maxInvoices: dto.maxInvoices ?? 6000,
        profileConfig: {
          create: {
            profileType: dto.profileType,
            invoiceTitle: defaults.invoiceTitle,
            partyLabel: defaults.partyLabel,
            partyIdLabel: defaults.partyIdLabel,
          },
        },
        brandTemplate: {
          create: {
            invoiceTitle: defaults.invoiceTitle,
          },
        },
      },
      include: { profileConfig: true },
    });

    await this.audit.log({
      tenantId: tenant.id,
      userId: actor.userId,
      action: 'TENANT_CREATED',
      entityType: 'Tenant',
      entityId: tenant.id,
      meta: { clientId: tenant.clientId, name: tenant.name },
    });

    await this.billing.startTrialForTenant(tenant.id, dto.planCode ?? 'GROWTH');

    let adminUser: Awaited<ReturnType<PlatformService['createTenantAdmin']>> | null =
      null;
    if (dto.adminEmail && dto.adminPassword && dto.adminFirstName && dto.adminLastName) {
      adminUser = await this.createTenantAdmin(actor, tenant.id, {
        email: dto.adminEmail,
        password: dto.adminPassword,
        firstName: dto.adminFirstName,
        lastName: dto.adminLastName,
        phone: dto.adminPhone,
      });
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: { status: TenantStatus.ACTIVE },
      });
      tenant.status = TenantStatus.ACTIVE;
    }

    return { ...tenant, adminUser };
  }

  async updateStatus(actor: AuthUser, tenantId: string, status: TenantStatus) {
    if (status === TenantStatus.SUSPENDED) {
      return this.suspendTenant(actor, tenantId);
    }
    if (status === TenantStatus.ACTIVE || status === TenantStatus.TRIAL) {
      const tenant = await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { status },
      });
      await this.audit.log({
        tenantId: tenant.id,
        userId: actor.userId,
        action: 'TENANT_STATUS_UPDATED',
        entityType: 'Tenant',
        entityId: tenant.id,
        meta: { status },
      });
      return tenant;
    }
    throw new BadRequestException('Invalid status');
  }

  listTenants(status?: TenantStatus) {
    return this.prisma.tenant.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { users: true, invoices: true } },
      },
    });
  }

  async suspendTenant(actor: AuthUser, tenantId: string) {
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: TenantStatus.SUSPENDED },
    });

    await this.audit.log({
      tenantId: tenant.id,
      userId: actor.userId,
      action: 'TENANT_SUSPENDED',
      entityType: 'Tenant',
      entityId: tenant.id,
    });

    return tenant;
  }

  async activateTenant(actor: AuthUser, tenantId: string) {
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: TenantStatus.ACTIVE },
    });

    await this.audit.log({
      tenantId: tenant.id,
      userId: actor.userId,
      action: 'TENANT_ACTIVATED',
      entityType: 'Tenant',
      entityId: tenant.id,
    });

    return tenant;
  }

  async createTenantAdmin(
    actor: AuthUser,
    tenantId: string,
    dto: CreateTenantAdminDto,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (existing) {
      throw new BadRequestException('Email already registered for tenant');
    }

    const password = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email,
        password,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: UserRole.CLIENT_ADMIN,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
      },
    });

    await this.audit.log({
      tenantId,
      userId: actor.userId,
      action: 'TENANT_ADMIN_CREATED',
      entityType: 'User',
      entityId: user.id,
      meta: { email: user.email },
    });

    return user;
  }
}
