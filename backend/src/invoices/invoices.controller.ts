import {
  Body,
  Controller,
  Delete,
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
import { InvoicesService } from './invoices.service';
import {
  CreateInvoiceDto,
  CreateNoteDto,
  AddPaymentDto,
  ListInvoicesQueryDto,
  ShareEmailDto,
  ShareWhatsappDto,
  VoidInvoiceDto,
  UpdateDraftInvoiceDto,
} from './dto/invoice.dto';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post()
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInvoiceDto) {
    return this.invoices.create(user, dto);
  }

  @Post('credit-notes')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR, UserRole.ACCOUNTANT)
  creditNote(@CurrentUser() user: AuthUser, @Body() dto: CreateNoteDto) {
    return this.invoices.createCreditNote(user, dto);
  }

  @Post('debit-notes')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR, UserRole.ACCOUNTANT)
  debitNote(@CurrentUser() user: AuthUser, @Body() dto: CreateNoteDto) {
    return this.invoices.createDebitNote(user, dto);
  }

  @Post(':id/payments')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR, UserRole.ACCOUNTANT)
  addPayment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AddPaymentDto,
  ) {
    return this.invoices.addPayment(user, id, dto);
  }

  @Get()
  @Roles(
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  list(@CurrentUser() user: AuthUser, @Query() query: ListInvoicesQueryDto) {
    return this.invoices.list(user.tenantId, query);
  }

  @Get('recycle-bin')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR, UserRole.ACCOUNTANT)
  recycleBin(@CurrentUser() user: AuthUser) {
    return this.invoices.listRecycleBin(user.tenantId);
  }

  @Post('recycle-bin/empty')
  @Roles(UserRole.CLIENT_ADMIN)
  emptyRecycleBin(@CurrentUser() user: AuthUser) {
    return this.invoices.emptyRecycleBin(user);
  }

  @Get(':id')
  @Roles(
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invoices.get(user.tenantId, id);
  }

  @Patch(':id')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR)
  updateDraft(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateDraftInvoiceDto,
  ) {
    return this.invoices.updateDraft(user, id, dto);
  }

  @Patch(':id/finalize')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR)
  finalize(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invoices.finalize(user, id);
  }

  @Post(':id/finalize')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR)
  finalizePost(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invoices.finalize(user, id);
  }

  @Patch(':id/void')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.ACCOUNTANT)
  void(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: VoidInvoiceDto,
  ) {
    return this.invoices.voidInvoice(user, id, dto.reason);
  }

  @Post(':id/void')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.ACCOUNTANT)
  voidPost(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: VoidInvoiceDto,
  ) {
    return this.invoices.voidInvoice(user, id, dto.reason);
  }

  @Delete(':id/permanent')
  @Roles(UserRole.CLIENT_ADMIN)
  permanentDelete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invoices.permanentDelete(user, id);
  }

  @Delete(':id')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR, UserRole.ACCOUNTANT)
  softDelete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invoices.softDelete(user, id);
  }

  @Post(':id/restore')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR, UserRole.ACCOUNTANT)
  restore(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invoices.restore(user, id);
  }

  @Post(':id/print')
  @Roles(
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  print(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invoices.print(user.tenantId, id);
  }

  @Post(':id/share/email')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR)
  shareEmail(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ShareEmailDto,
  ) {
    return this.invoices.shareEmail(user, id, dto);
  }

  @Post(':id/share/whatsapp')
  @Roles(UserRole.CLIENT_ADMIN, UserRole.BILLING_OPERATOR)
  shareWhatsapp(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ShareWhatsappDto,
  ) {
    return this.invoices.shareWhatsapp(user, id, dto);
  }
}
