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
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/purchase.dto';

@Controller('purchases')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get()
  @Roles(
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  list(@CurrentUser() user: AuthUser) {
    return this.purchases.list(user.tenantId);
  }

  @Get(':id')
  @Roles(
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.purchases.get(user.tenantId, id);
  }

  @Post()
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR, UserRole.ACCOUNTANT)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePurchaseDto) {
    return this.purchases.create(user, dto);
  }

  @Post(':id/void')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.ACCOUNTANT)
  void(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.purchases.void(user.tenantId, id);
  }
}
