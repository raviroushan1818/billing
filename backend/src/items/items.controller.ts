import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { ItemsService } from './items.service';
import { CreateItemDto, UpdateItemDto, AdjustStockDto } from './dto/item.dto';
import { BillingService } from '../billing/billing.service';

@Controller('items')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ItemsController {
  constructor(
    private readonly items: ItemsService,
    private readonly billing: BillingService,
  ) {}

  @Post()
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateItemDto) {
    return this.items.create(user.tenantId, dto);
  }

  @Get()
  @Roles(
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  list(@CurrentUser() user: AuthUser, @Query('all') all?: string) {
    return this.items.list(user.tenantId, all !== 'true');
  }

  @Get('search')
  @Roles(
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  search(
    @CurrentUser() user: AuthUser,
    @Query('q') q: string,
    @Query('take') take?: string,
  ) {
    return this.items.search(user.tenantId, q ?? '', take ? Number(take) : 30);
  }

  @Get('import/template')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="items-template.csv"')
  template(@Res() res: Response) {
    res.send(this.items.templateCsv());
  }

  @Post('import')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  importCsv(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.billing.assertFeature(user.tenantId, 'csvImport', 'CSV import').then(
      () => {
        const text = file?.buffer?.toString('utf8') ?? '';
        return this.items.importCsv(user.tenantId, text);
      },
    );
  }

  @Get(':id/movements')
  @Roles(
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  movements(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.items.listMovements(user.tenantId, id);
  }

  @Post(':id/stock')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR)
  adjustStock(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.billing
      .assertFeature(user.tenantId, 'stock', 'Inventory stock')
      .then(() =>
        this.items.adjustStock(user.tenantId, id, dto, user.userId),
      );
  }

  @Get(':id')
  @Roles(
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.items.get(user.tenantId, id);
  }

  @Patch(':id')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.items.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.items.remove(user.tenantId, id);
  }
}
