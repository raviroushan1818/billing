import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SubscriptionStatus, UserRole } from '@prisma/client';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';
import {
  CurrentUser,
  AuthUser,
} from '../common/decorators/current-user.decorator';
import { BillingService } from './billing.service';
import {
  AssignSubscriptionDto,
  CheckoutDto,
  CreatePlanDto,
  UpdatePaymentSettingsDto,
  UpdatePlanDto,
  UpdateSubscriptionDto,
  VerifyCheckoutDto,
} from './dto/billing.dto';

@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('public/plans')
  publicPlans() {
    return this.billing.listPlans({ publicOnly: true, activeOnly: true });
  }

  @Get('public/payment-mode')
  publicPaymentMode() {
    return this.billing.getPublicPaymentMode();
  }

  @Post('billing/webhooks/razorpay')
  razorpayWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature?: string,
  ) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    return this.billing.handleRazorpayWebhook(raw, signature);
  }

  @Get('platform/plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  listAllPlans() {
    return this.billing.listPlans({ activeOnly: false });
  }

  @Post('platform/plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  createPlan(@CurrentUser() user: AuthUser, @Body() dto: CreatePlanDto) {
    return this.billing.createPlan(user, dto);
  }

  @Get('platform/plans/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  getPlan(@Param('id') id: string) {
    return this.billing.getPlan(id);
  }

  @Patch('platform/plans/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  updatePlan(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.billing.updatePlan(user, id, dto);
  }

  @Delete('platform/plans/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  deactivatePlan(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.billing.deactivatePlan(user, id);
  }

  @Get('platform/subscriptions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  listSubs(
    @Query('status') status?: SubscriptionStatus,
    @Query('planId') planId?: string,
    @Query('expiringDays') expiringDays?: string,
  ) {
    return this.billing.listSubscriptions({
      status,
      planId,
      expiringDays: expiringDays ? Number(expiringDays) : undefined,
    });
  }

  @Post('platform/tenants/:id/subscription')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  assign(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AssignSubscriptionDto,
  ) {
    return this.billing.assignSubscription(user, id, dto);
  }

  @Patch('platform/subscriptions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  updateSub(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.billing.updateSubscription(user, id, dto);
  }

  @Get('platform/payment-settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  getPaymentSettings() {
    return this.billing.getPaymentSettingsAdmin();
  }

  @Put('platform/payment-settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  putPaymentSettings(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePaymentSettingsDto,
  ) {
    return this.billing.updatePaymentSettings(user, dto);
  }

  @Get('platform/payment-orders')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  paymentOrders() {
    return this.billing.listPaymentOrders();
  }

  @Get('platform/analytics/billing')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  analytics() {
    return this.billing.billingAnalytics();
  }

  @Get('billing/features')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  features(@CurrentUser() user: AuthUser) {
    return this.billing.tenantFeatures(user.tenantId);
  }

  @Get('billing/subscription')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.CLIENT_ADMIN,
    UserRole.BILLING_OPERATOR,
    UserRole.ACCOUNTANT,
    UserRole.VIEWER,
  )
  tenantSub(@CurrentUser() user: AuthUser) {
    return this.billing.getTenantSubscription(user.tenantId);
  }

  @Post('billing/checkout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT_ADMIN)
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    return this.billing.checkout(user, dto);
  }

  @Post('billing/checkout/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CLIENT_ADMIN)
  verify(@CurrentUser() user: AuthUser, @Body() dto: VerifyCheckoutDto) {
    return this.billing.verifyCheckout(user, dto);
  }
}
