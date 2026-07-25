import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { AuditService } from './audit.service';
import { PLATFORM_CLIENT_ID } from '../common/constants';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.ACCOUNTANT,
  )
  list(
    @CurrentUser() user: AuthUser,
    @Query('take') take?: string,
  ) {
    const tenantId =
      user.clientId === PLATFORM_CLIENT_ID && user.role === UserRole.SUPER_ADMIN
        ? null
        : user.tenantId;
    return this.audit.list(tenantId, take ? Number(take) : 100);
  }
}
