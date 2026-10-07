import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class HmsApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const apiKey =
      (req.headers['x-billing-api-key'] as string | undefined)?.trim() ||
      extractBearerHmsKey(req.headers.authorization as string | undefined);
    const clientId = (
      (req.headers['x-billing-client-id'] as string | undefined) ||
      (req.body?.clientId as string | undefined) ||
      ''
    )
      .trim()
      .toUpperCase();

    if (!apiKey || !clientId) {
      throw new UnauthorizedException(
        'HMS bridge requires X-Billing-Api-Key and X-Billing-Client-Id',
      );
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { clientId },
      include: { integrations: true },
    });
    if (!tenant || tenant.status === 'SUSPENDED') {
      throw new UnauthorizedException('Invalid HMS credentials');
    }

    const hash = hashApiKey(apiKey);
    const stored = tenant.integrations?.hmsApiKeyHash;
    if (!stored || stored !== hash) {
      throw new UnauthorizedException('Invalid HMS credentials');
    }

    let bridgeUserId = tenant.integrations?.hmsBridgeUserId || null;
    if (!bridgeUserId) {
      const bridge = await this.prisma.user.findFirst({
        where: {
          tenantId: tenant.id,
          email: 'hms-bridge@system.local',
          isActive: true,
        },
      });
      bridgeUserId = bridge?.id || null;
    }
    if (!bridgeUserId) {
      throw new UnauthorizedException(
        'HMS bridge user not configured. Generate an API key in billing Integrations.',
      );
    }

    const user: AuthUser = {
      userId: bridgeUserId,
      tenantId: tenant.id,
      clientId: tenant.clientId,
      role: 'BILLING_OPERATOR',
      email: 'hms-bridge@system.local',
    };
    req.user = user;
    return true;
  }
}

export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey, 'utf8').digest('hex');
}

function extractBearerHmsKey(authorization?: string): string | undefined {
  if (!authorization) return undefined;
  const m = authorization.match(/^Bearer\s+(hms_[A-Za-z0-9_-]+)\s*$/i);
  return m?.[1];
}
