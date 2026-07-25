import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  CreateTenantUserDto,
  UpdateProfileConfigDto,
  UpdateTenantUserDto,
} from './dto/tenant.dto';

const ALLOWED_ROLES: UserRole[] = [
  UserRole.BILLING_OPERATOR,
  UserRole.ACCOUNTANT,
  UserRole.VIEWER,
  UserRole.CLIENT_ADMIN,
];

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listUsers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: USER_SELECT,
    });
  }

  async createUser(actor: AuthUser, dto: CreateTenantUserDto) {
    if (actor.role !== UserRole.CLIENT_ADMIN) {
      throw new ForbiddenException('Only the Owner can create users');
    }

    if (dto.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException('Cannot assign SUPER_ADMIN role');
    }

    const role = dto.role ?? UserRole.BILLING_OPERATOR;
    if (!ALLOWED_ROLES.includes(role)) {
      throw new BadRequestException('Invalid role for tenant user');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: actor.tenantId },
      include: { _count: { select: { users: true } } },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');

    if (tenant._count.users >= tenant.maxUsers) {
      throw new BadRequestException('Maximum user limit reached');
    }

    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: actor.tenantId, email } },
    });
    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const password = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        tenantId: actor.tenantId,
        email,
        password,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role,
      },
      select: USER_SELECT,
    });

    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: user.id,
      meta: { email: user.email, role: user.role },
    });

    return user;
  }

  async updateUser(actor: AuthUser, userId: string, dto: UpdateTenantUserDto) {
    if (actor.role !== UserRole.CLIENT_ADMIN) {
      throw new ForbiddenException('Only the Owner can update users');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: userId, tenantId: actor.tenantId },
    });
    if (!target) throw new NotFoundException('User not found');

    if (dto.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException('Cannot assign SUPER_ADMIN role');
    }
    if (dto.role !== undefined && !ALLOWED_ROLES.includes(dto.role)) {
      throw new BadRequestException('Invalid role for tenant user');
    }

    const nextRole = dto.role ?? target.role;
    const nextActive = dto.isActive ?? target.isActive;

    if (
      target.role === UserRole.CLIENT_ADMIN &&
      (nextRole !== UserRole.CLIENT_ADMIN || nextActive === false)
    ) {
      await this.assertNotSoleOwner(actor.tenantId, target.id);
    }

    const user = await this.prisma.user.update({
      where: { id: target.id },
      data: {
        role: dto.role,
        isActive: dto.isActive,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone === undefined ? undefined : dto.phone,
      },
      select: USER_SELECT,
    });

    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: user.id,
      meta: {
        role: user.role,
        isActive: user.isActive,
      },
    });

    return user;
  }

  private async assertNotSoleOwner(tenantId: string, userId: string) {
    const owners = await this.prisma.user.count({
      where: {
        tenantId,
        role: UserRole.CLIENT_ADMIN,
        isActive: true,
        id: { not: userId },
      },
    });
    if (owners < 1) {
      throw new BadRequestException(
        'Cannot demote or deactivate the only Owner. Assign another Owner first.',
      );
    }
  }

  async getMe(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { profileConfig: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  getProfileConfig(tenantId: string) {
    return this.prisma.tenantProfileConfig.findUnique({
      where: { tenantId },
    });
  }

  async updateProfileConfig(actor: AuthUser, dto: UpdateProfileConfigDto) {
    const existing = await this.prisma.tenantProfileConfig.findUnique({
      where: { tenantId: actor.tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Profile config not found');
    }

    const updated = await this.prisma.tenantProfileConfig.update({
      where: { tenantId: actor.tenantId },
      data: {
        invoiceTitle: dto.invoiceTitle,
        partyLabel: dto.partyLabel,
        partyIdLabel: dto.partyIdLabel,
        customFieldSchema: dto.customFieldSchema as
          | Prisma.InputJsonValue
          | undefined,
      },
    });

    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'PROFILE_CONFIG_UPDATED',
      entityType: 'TenantProfileConfig',
      entityId: updated.id,
    });

    return updated;
  }
}
