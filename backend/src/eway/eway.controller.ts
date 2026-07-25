import {
  Body,
  Controller,
  Get,
  Param,
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
import { EwayService } from './eway.service';
import { CancelEwayDto, CreateEwayDto } from './dto/eway.dto';

@Controller('eway')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EwayController {
  constructor(private readonly eway: EwayService) {}

  @Get()
  @Roles(
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  list(@CurrentUser() user: AuthUser) {
    return this.eway.list(user.tenantId);
  }

  @Get(':id')
  @Roles(
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.eway.get(user.tenantId, id);
  }

  @Post()
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR, UserRole.ACCOUNTANT)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEwayDto) {
    return this.eway.create(user, dto);
  }

  @Post(':id/cancel')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.ACCOUNTANT)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelEwayDto,
  ) {
    return this.eway.cancel(user.tenantId, id, dto.reason);
  }
}
