import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from './jwt.strategy';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { clientId: dto.clientId.trim().toUpperCase() },
    });

    if (!tenant) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (tenant.status === 'SUSPENDED') {
      throw new UnauthorizedException('Tenant suspended');
    }

    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: {
        tenantId_email: { tenantId: tenant.id, email },
      },
      include: { tenant: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account temporarily locked');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      const failed = user.failedLogins + 1;
      const lockedUntil =
        failed >= MAX_FAILED_LOGINS
          ? new Date(Date.now() + LOCK_MINUTES * 60_000)
          : null;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins: failed,
          lockedUntil,
        },
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    return this.buildAuthResponse(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found');
    }
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
      clientId: user.tenant.clientId,
      tenantName: user.tenant.name,
      profileType: user.tenant.profileType,
      preferredPrintFormat: user.preferredPrintFormat ?? null,
      preferredInvoiceTheme: user.preferredInvoiceTheme ?? null,
      tenant: {
        id: user.tenant.id,
        clientId: user.tenant.clientId,
        name: user.tenant.name,
        profileType: user.tenant.profileType,
      },
    };
  }

  async changePassword(user: AuthUser, dto: ChangePasswordDto) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
    });

    if (!dbUser) {
      throw new UnauthorizedException('User not found');
    }

    const valid = await bcrypt.compare(dto.currentPassword, dbUser.password);
    if (!valid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const password = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: dbUser.id },
      data: { password },
    });

    return { message: 'Password updated' };
  }

  async updateBillingPreferences(
    user: AuthUser,
    dto: {
      preferredPrintFormat?: string | null;
      preferredInvoiceTheme?: string | null;
    },
  ) {
    const data: Record<string, unknown> = {};
    if (dto.preferredPrintFormat !== undefined) {
      data.preferredPrintFormat = dto.preferredPrintFormat || null;
    }
    if (dto.preferredInvoiceTheme !== undefined) {
      data.preferredInvoiceTheme = dto.preferredInvoiceTheme || null;
    }

    await this.prisma.user.update({
      where: { id: user.userId },
      data,
    });

    return this.me(user.userId);
  }

  /** Used by HMS bridge / SSO to mint the same JWT shape as login. */
  issueTokenForUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string;
    preferredPrintFormat?: string | null;
    preferredInvoiceTheme?: string | null;
    tenant: { clientId: string; name: string; profileType: string };
  }) {
    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string;
    preferredPrintFormat?: string | null;
    preferredInvoiceTheme?: string | null;
    tenant: { clientId: string; name: string; profileType: string };
  }) {
    const payload: JwtPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      clientId: user.tenant.clientId,
      role: user.role,
      email: user.email,
    };

    const accessToken = this.jwt.sign(payload, {
      expiresIn: this.config.get('JWT_EXPIRES_IN', '8h'),
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        clientId: user.tenant.clientId,
        tenantName: user.tenant.name,
        profileType: user.tenant.profileType,
        preferredPrintFormat: user.preferredPrintFormat ?? null,
        preferredInvoiceTheme: user.preferredInvoiceTheme ?? null,
      },
    };
  }
}
