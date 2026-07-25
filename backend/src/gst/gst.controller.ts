import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { GstService } from './gst.service';
import { UpsertGstSettingsDto } from './dto/gst.dto';

@Controller('gst')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GstController {
  constructor(private readonly gst: GstService) {}

  @Get('settings')
  @Roles(
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  get(@CurrentUser() user: AuthUser) {
    return this.gst.get(user.tenantId);
  }

  @Put('settings')
  @Roles(UserRole.CLIENT_ADMIN)
  upsert(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpsertGstSettingsDto,
  ) {
    return this.gst.upsert(user.tenantId, dto);
  }
}
