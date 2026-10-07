import { randomBytes } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TenantStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PROFILE_DEFAULTS } from '../common/constants';
import {
  CreateTenantAdminDto,
  CreateTenantDto,
  UpdatePlatformSettingsDto,
} from './dto/platform.dto';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { BillingService } from '../billing/billing.service';

type ClientIdFormat = {
  clientIdPrefix: string;
  clientIdSeparator: string;
  clientIdSuffixLength: number;
};

const DEFAULT_FORMAT: ClientIdFormat = {
  clientIdPrefix: 'CLI',
  clientIdSeparator: '-',
  clientIdSuffixLength: 8,
};

function buildClientId(format: ClientIdFormat): string {
  const len = Math.min(16, Math.max(4, format.clientIdSuffixLength || 8));
  const bytes = Math.ceil(len / 2);
  const suffix = randomBytes(bytes)
    .toString('hex')
    .toUpperCase()
    .slice(0, len);
  const prefix = (format.clientIdPrefix || 'CLI').toUpperCase();
  const sep = format.clientIdSeparator ?? '-';
  return `${prefix}${sep}${suffix}`;
}

function normalizeClientId(raw: string): string {
  return raw.trim().toUpperCase();
}

function assertClientIdValue(clientId: string) {
  if (clientId === 'PLATFORM') {
    throw new BadRequestException('PLATFORM is a reserved Client ID');
  }
  if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(clientId)) {
    throw new BadRequestException(
      'Client ID must start with a letter/number and use only letters, numbers, _ or -',
    );
  }
  if (clientId.length < 3 || clientId.length > 32) {
    throw new BadRequestException('Client ID must be 3–32 characters');
  }
}

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly billing: BillingService,
  ) {}

  async getSettings() {
    const settings = await this.ensureSettings();
    return {
      ...settings,
      sampleClientId: buildClientId(settings),
    };
  }

  async updateSettings(actor: AuthUser, dto: UpdatePlatformSettingsDto) {
    const current = await this.ensureSettings();
    const updated = await this.prisma.platformSettings.update({
      where: { id: 'default' },
      data: {
        clientIdPrefix:
          dto.clientIdPrefix !== undefined
            ? dto.clientIdPrefix.toUpperCase()
            : undefined,
        clientIdSeparator:
          dto.clientIdSeparator !== undefined
            ? dto.clientIdSeparator
            : undefined,
        clientIdSuffixLength:
          dto.clientIdSuffixLength !== undefined
            ? dto.clientIdSuffixLength
            : undefined,
      },
    });

    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'PLATFORM_SETTINGS_UPDATED',
      entityType: 'PlatformSettings',
      entityId: 'default',
      meta: {
        before: {
          clientIdPrefix: current.clientIdPrefix,
          clientIdSeparator: current.clientIdSeparator,
          clientIdSuffixLength: current.clientIdSuffixLength,
        },
        after: {
          clientIdPrefix: updated.clientIdPrefix,
          clientIdSeparator: updated.clientIdSeparator,
          clientIdSuffixLength: updated.clientIdSuffixLength,
        },
      },
    });

    return {
      ...updated,
      sampleClientId: buildClientId(updated),
    };
  }

  async createTenant(actor: AuthUser, dto: CreateTenantDto) {
    const settings = await this.ensureSettings();
    let clientId = dto.clientId
      ? normalizeClientId(dto.clientId)
      : buildClientId(settings);

    if (dto.clientId) {
      assertClientIdValue(clientId);
      const exists = await this.prisma.tenant.findUnique({
        where: { clientId },
      });
      if (exists) {
        throw new BadRequestException('Client ID already in use');
      }
    } else {
      for (let i = 0; i < 8; i++) {
        const exists = await this.prisma.tenant.findUnique({
          where: { clientId },
        });
        if (!exists) break;
        clientId = buildClientId(settings);
      }
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

    let adminUser: Awaited<
      ReturnType<PlatformService['createTenantAdmin']>
    > | null = null;
    if (
      dto.adminEmail &&
      dto.adminPassword &&
      dto.adminFirstName &&
      dto.adminLastName
    ) {
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

  async updateClientId(actor: AuthUser, tenantId: string, rawClientId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (tenant.clientId === 'PLATFORM') {
      throw new BadRequestException('Cannot change the PLATFORM Client ID');
    }

    const clientId = normalizeClientId(rawClientId);
    assertClientIdValue(clientId);
    if (clientId === tenant.clientId) return tenant;

    const clash = await this.prisma.tenant.findUnique({ where: { clientId } });
    if (clash) {
      throw new BadRequestException('Client ID already in use');
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { clientId },
    });

    await this.audit.log({
      tenantId: tenant.id,
      userId: actor.userId,
      action: 'TENANT_CLIENT_ID_UPDATED',
      entityType: 'Tenant',
      entityId: tenant.id,
      meta: { from: tenant.clientId, to: clientId },
    });

    return updated;
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

  private async ensureSettings() {
    const existing = await this.prisma.platformSettings.findUnique({
      where: { id: 'default' },
    });
    if (existing) return existing;
    return this.prisma.platformSettings.create({
      data: { id: 'default', ...DEFAULT_FORMAT },
    });
  }
}
