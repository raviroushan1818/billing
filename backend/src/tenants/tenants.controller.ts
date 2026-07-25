import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';
import {
  CurrentUser,
  AuthUser,
} from '../common/decorators/current-user.decorator';
import { TenantsService } from './tenants.service';
import {
  CreateTenantUserDto,
  UpdateProfileConfigDto,
  UpdateTenantUserDto,
} from './dto/tenant.dto';

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get('me')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  me(@CurrentUser() user: AuthUser) {
    return this.tenants.getMe(user.tenantId);
  }

  @Get('users')
  @Roles(UserRole.CLIENT_ADMIN)
  listUsers(@CurrentUser() user: AuthUser) {
    return this.tenants.listUsers(user.tenantId);
  }

  @Post('users')
  @Roles(UserRole.CLIENT_ADMIN)
  createUser(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTenantUserDto,
  ) {
    return this.tenants.createUser(user, dto);
  }

  @Patch('users/:id')
  @Roles(UserRole.CLIENT_ADMIN)
  updateUser(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTenantUserDto,
  ) {
    return this.tenants.updateUser(user, id, dto);
  }

  @Get('profile-config')
  @Roles(
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  getProfileConfig(@CurrentUser() user: AuthUser) {
    return this.tenants.getProfileConfig(user.tenantId);
  }

  @Patch('profile-config')
  @Roles(UserRole.CLIENT_ADMIN)
  updateProfileConfig(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileConfigDto,
  ) {
    return this.tenants.updateProfileConfig(user, dto);
  }
}
