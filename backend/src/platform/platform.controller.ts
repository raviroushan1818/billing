import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';
import {
  CurrentUser,
  AuthUser,
} from '../common/decorators/current-user.decorator';
import { PlatformService } from './platform.service';
import {
  CreateTenantAdminDto,
  CreateTenantDto,
  UpdatePlatformSettingsDto,
  UpdateTenantClientIdDto,
  UpdateTenantStatusDto,
} from './dto/platform.dto';

@Controller('platform')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('settings')
  getSettings() {
    return this.platform.getSettings();
  }

  @Patch('settings')
  updateSettings(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePlatformSettingsDto,
  ) {
    return this.platform.updateSettings(user, dto);
  }

  @Post('tenants')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTenantDto) {
    return this.platform.createTenant(user, dto);
  }

  @Get('tenants')
  list(@Query('status') status?: TenantStatus) {
    return this.platform.listTenants(status);
  }

  @Patch('tenants/:id/client-id')
  updateClientId(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTenantClientIdDto,
  ) {
    return this.platform.updateClientId(user, id, dto.clientId);
  }

  @Patch('tenants/:id/status')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTenantStatusDto,
  ) {
    return this.platform.updateStatus(user, id, dto.status);
  }

  @Patch('tenants/:id/suspend')
  suspend(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.platform.suspendTenant(user, id);
  }

  @Patch('tenants/:id/activate')
  activate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.platform.activateTenant(user, id);
  }

  @Post('tenants/:id/admin')
  createAdmin(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateTenantAdminDto,
  ) {
    return this.platform.createTenantAdmin(user, id, dto);
  }
}
