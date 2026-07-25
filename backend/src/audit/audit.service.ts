import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    tenantId?: string | null;
    userId?: string | null;
    action: string;
    entityType?: string;
    entityId?: string;
    meta?: Prisma.InputJsonValue;
    ip?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: input.tenantId ?? null,
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        meta: input.meta,
        ip: input.ip,
      },
    });
  }

  list(tenantId: string | null, take = 100) {
    return this.prisma.auditLog.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        user: { select: { email: true, firstName: true, lastName: true } },
      },
    });
  }
}
