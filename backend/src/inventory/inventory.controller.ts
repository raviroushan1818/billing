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
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';
import {
  CurrentUser,
  AuthUser,
} from '../common/decorators/current-user.decorator';
import { InventoryService } from './inventory.service';
import {
  AdjustGodownStockDto,
  CreateGodownDto,
  TransferStockDto,
  UpdateGodownDto,
} from './dto/inventory.dto';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('godowns')
  @Roles(
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  list(@CurrentUser() user: AuthUser) {
    return this.inventory.listGodowns(user.tenantId);
  }

  @Post('godowns')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGodownDto) {
    return this.inventory.createGodown(user.tenantId, dto);
  }

  @Patch('godowns/:id')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateGodownDto,
  ) {
    return this.inventory.updateGodown(user.tenantId, id, dto);
  }

  @Get('inventory/stock')
  @Roles(
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  stock(
    @CurrentUser() user: AuthUser,
    @Query('godownId') godownId?: string,
  ) {
    return this.inventory.stockByGodown(user.tenantId, godownId);
  }

  @Post('inventory/transfer')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR)
  transfer(@CurrentUser() user: AuthUser, @Body() dto: TransferStockDto) {
    return this.inventory.transfer(user.tenantId, dto, user.userId);
  }

  @Post('inventory/items/:itemId/godowns/:godownId/adjust')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR)
  adjust(
    @CurrentUser() user: AuthUser,
    @Param('itemId') itemId: string,
    @Param('godownId') godownId: string,
    @Body() dto: AdjustGodownStockDto,
  ) {
    return this.inventory.adjustAtGodown(
      user.tenantId,
      itemId,
      godownId,
      dto.qtyDelta,
      dto.note,
      user.userId,
    );
  }
}
