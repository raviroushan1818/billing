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
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { PlatformService } from './platform.service';
import {
  CreateTenantAdminDto,
  CreateTenantDto,
  UpdateTenantStatusDto,
} from './dto/platform.dto';

@Controller('platform/tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTenantDto) {
    return this.platform.createTenant(user, dto);
  }

  @Get()
  list(@Query('status') status?: TenantStatus) {
    return this.platform.listTenants(status);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTenantStatusDto,
  ) {
    return this.platform.updateStatus(user, id, dto.status);
  }

  @Patch(':id/suspend')
  suspend(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.platform.suspendTenant(user, id);
  }

  @Patch(':id/activate')
  activate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.platform.activateTenant(user, id);
  }

  @Post(':id/admin')
  createAdmin(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateTenantAdminDto,
  ) {
    return this.platform.createTenantAdmin(user, id, dto);
  }
}
