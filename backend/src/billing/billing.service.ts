import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillingCycle,
  PaymentOrderStatus,
  PaymentProvider,
  Prisma,
  SubPaymentMethod,
  SubscriptionStatus,
  TenantStatus,
} from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { decryptSecret, encryptSecret } from '../common/crypto.util';
import {
  AssignSubscriptionDto,
  CheckoutDto,
  CreatePlanDto,
  UpdatePaymentSettingsDto,
  UpdatePlanDto,
  UpdateSubscriptionDto,
  VerifyCheckoutDto,
} from './dto/billing.dto';

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Plans ──────────────────────────────────────────────

  listPlans(opts?: { publicOnly?: boolean; activeOnly?: boolean }) {
    const where: Prisma.SubscriptionPlanWhereInput = {};
    if (opts?.publicOnly) where.isPublic = true;
    if (opts?.activeOnly !== false) where.isActive = true;
    return this.prisma.subscriptionPlan.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { priceMonthlyInr: 'asc' }],
    });
  }

  async getPlan(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  createPlan(actor: AuthUser, dto: CreatePlanDto) {
    return this.prisma.subscriptionPlan.create({
      data: {
        code: dto.code.toUpperCase().trim(),
        name: dto.name,
        description: dto.description ?? '',
        priceMonthlyInr: dto.priceMonthlyInr,
        priceYearlyInr: dto.priceYearlyInr,
        maxUsers: dto.maxUsers,
        maxInvoices: dto.maxInvoices,
        trialDays: dto.trialDays ?? 14,
        features: dto.features ?? [],
        isPublic: dto.isPublic ?? true,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
        isCustom: dto.isCustom ?? false,
      },
    }).then(async (plan) => {
      await this.audit.log({
        userId: actor.userId,
        action: 'PLAN_CREATED',
        entityType: 'SubscriptionPlan',
        entityId: plan.id,
        meta: { code: plan.code },
      });
      return plan;
    });
  }

  async updatePlan(actor: AuthUser, id: string, dto: UpdatePlanDto) {
    await this.getPlan(id);
    const plan = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        priceMonthlyInr: dto.priceMonthlyInr,
        priceYearlyInr: dto.priceYearlyInr,
        maxUsers: dto.maxUsers,
        maxInvoices: dto.maxInvoices,
        trialDays: dto.trialDays,
        features: dto.features,
        isPublic: dto.isPublic,
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
        isCustom: dto.isCustom,
      },
    });
    await this.audit.log({
      userId: actor.userId,
      action: 'PLAN_UPDATED',
      entityType: 'SubscriptionPlan',
      entityId: plan.id,
    });
    return plan;
  }

  async deactivatePlan(actor: AuthUser, id: string) {
    const plan = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: { isActive: false, isPublic: false },
    });
    await this.audit.log({
      userId: actor.userId,
      action: 'PLAN_DEACTIVATED',
      entityType: 'SubscriptionPlan',
      entityId: plan.id,
    });
    return plan;
  }

  // ── Payment settings ───────────────────────────────────

  async getPaymentSettingsAdmin() {
    const row = await this.ensurePaymentSettings();
    return {
      id: row.id,
      gatewayEnabled: row.gatewayEnabled,
      razorpayKeyId: row.razorpayKeyId,
      hasKeySecret: Boolean(row.razorpayKeySecretEnc),
      hasWebhookSecret: Boolean(row.razorpayWebhookSecretEnc),
      manualUpiId: row.manualUpiId,
      manualBankDetails: row.manualBankDetails,
      updatedAt: row.updatedAt,
    };
  }

  async getPublicPaymentMode() {
    const row = await this.ensurePaymentSettings();
    const razorpayReady =
      row.gatewayEnabled &&
      Boolean(row.razorpayKeyId) &&
      Boolean(row.razorpayKeySecretEnc);
    if (razorpayReady) {
      return {
        mode: 'razorpay' as const,
        keyId: row.razorpayKeyId!,
        manualUpiId: row.manualUpiId,
        manualBankDetails: row.manualBankDetails,
      };
    }
    return {
      mode: 'manual' as const,
      manualUpiId: row.manualUpiId,
      manualBankDetails: row.manualBankDetails,
    };
  }

  async updatePaymentSettings(actor: AuthUser, dto: UpdatePaymentSettingsDto) {
    const existing = await this.ensurePaymentSettings();
    const data: Prisma.PlatformPaymentSettingsUpdateInput = {
      updatedById: actor.userId,
    };
    if (dto.gatewayEnabled !== undefined) data.gatewayEnabled = dto.gatewayEnabled;
    if (dto.razorpayKeyId !== undefined) {
      data.razorpayKeyId = dto.razorpayKeyId === '' ? null : dto.razorpayKeyId;
    }
    if (dto.razorpayKeySecret !== undefined) {
      data.razorpayKeySecretEnc =
        dto.razorpayKeySecret === '' || dto.razorpayKeySecret === null
          ? null
          : encryptSecret(dto.razorpayKeySecret);
    }
    if (dto.razorpayWebhookSecret !== undefined) {
      data.razorpayWebhookSecretEnc =
        dto.razorpayWebhookSecret === '' || dto.razorpayWebhookSecret === null
          ? null
          : encryptSecret(dto.razorpayWebhookSecret);
    }
    if (dto.manualUpiId !== undefined) {
      data.manualUpiId = dto.manualUpiId === '' ? null : dto.manualUpiId;
    }
    if (dto.manualBankDetails !== undefined) {
      data.manualBankDetails =
        dto.manualBankDetails === '' ? null : dto.manualBankDetails;
    }
    await this.prisma.platformPaymentSettings.update({
      where: { id: existing.id },
      data,
    });
    await this.audit.log({
      userId: actor.userId,
      action: 'PAYMENT_SETTINGS_UPDATED',
      entityType: 'PlatformPaymentSettings',
      entityId: existing.id,
      meta: { gatewayEnabled: dto.gatewayEnabled },
    });
    return this.getPaymentSettingsAdmin();
  }

  private async ensurePaymentSettings() {
    const existing = await this.prisma.platformPaymentSettings.findFirst();
    if (existing) return existing;
    return this.prisma.platformPaymentSettings.create({ data: {} });
  }

  // ── Subscriptions ──────────────────────────────────────

  listSubscriptions(query: {
    status?: SubscriptionStatus;
    planId?: string;
    expiringDays?: number;
  }) {
    const where: Prisma.TenantSubscriptionWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.planId) where.planId = query.planId;
    if (query.expiringDays != null) {
      const until = addDays(new Date(), query.expiringDays);
      where.endsAt = { lte: until };
      where.status = { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] };
    }
    return this.prisma.tenantSubscription.findMany({
      where,
      include: {
        plan: true,
        tenant: { select: { id: true, clientId: true, name: true, status: true } },
      },
      orderBy: { endsAt: 'asc' },
      take: 500,
    });
  }

  async assignSubscription(
    actor: AuthUser,
    tenantId: string,
    dto: AssignSubscriptionDto,
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (tenant.clientId === 'PLATFORM') {
      throw new BadRequestException('Cannot assign plan to PLATFORM tenant');
    }
    const plan = await this.getPlan(dto.planId);
    const cycle = dto.billingCycle ?? BillingCycle.YEARLY;
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date();
    const endsAt = dto.endsAt
      ? new Date(dto.endsAt)
      : addDays(startsAt, cycle === BillingCycle.YEARLY ? 365 : 30);
    const amount =
      dto.amountInr ??
      (cycle === BillingCycle.YEARLY ? plan.priceYearlyInr : plan.priceMonthlyInr);
    const status = dto.status ?? SubscriptionStatus.ACTIVE;

    await this.prisma.tenantSubscription.updateMany({
      where: {
        tenantId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
      },
      data: { status: SubscriptionStatus.CANCELLED },
    });

    const sub = await this.prisma.tenantSubscription.create({
      data: {
        tenantId,
        planId: plan.id,
        billingCycle: cycle,
        status,
        startsAt,
        endsAt,
        amountInr: amount,
        paymentMethod: dto.paymentMethod ?? SubPaymentMethod.MANUAL,
        paymentRef: dto.paymentRef,
        notes: dto.notes,
        assignedById: actor.userId,
      },
      include: { plan: true },
    });

    await this.syncTenantLimits(tenantId, plan, status);
    await this.audit.log({
      tenantId,
      userId: actor.userId,
      action: 'SUBSCRIPTION_ASSIGNED',
      entityType: 'TenantSubscription',
      entityId: sub.id,
      meta: { planCode: plan.code, status, amount },
    });
    return sub;
  }

  async updateSubscription(
    actor: AuthUser,
    id: string,
    dto: UpdateSubscriptionDto,
  ) {
    const sub = await this.prisma.tenantSubscription.findUnique({
      where: { id },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException('Subscription not found');

    let endsAt = dto.endsAt ? new Date(dto.endsAt) : sub.endsAt;
    if (dto.extendDays != null) {
      endsAt = addDays(endsAt > new Date() ? endsAt : new Date(), dto.extendDays);
    }

    let plan = sub.plan;
    if (dto.planId && dto.planId !== sub.planId) {
      plan = await this.getPlan(dto.planId);
    }

    const updated = await this.prisma.tenantSubscription.update({
      where: { id },
      data: {
        status: dto.status,
        endsAt,
        paymentRef: dto.paymentRef,
        notes: dto.notes,
        planId: plan.id,
        billingCycle: dto.billingCycle,
        amountInr: dto.amountInr,
        assignedById: actor.userId,
      },
      include: { plan: true },
    });

    await this.syncTenantLimits(
      sub.tenantId,
      updated.plan,
      updated.status,
    );
    await this.audit.log({
      tenantId: sub.tenantId,
      userId: actor.userId,
      action: 'SUBSCRIPTION_UPDATED',
      entityType: 'TenantSubscription',
      entityId: id,
      meta: dto as unknown as Prisma.InputJsonValue,
    });
    return updated;
  }

  async startTrialForTenant(tenantId: string, planCode = 'GROWTH') {
    const plan =
      (await this.prisma.subscriptionPlan.findUnique({ where: { code: planCode } })) ??
      (await this.prisma.subscriptionPlan.findFirst({
        where: { isActive: true, isCustom: false },
        orderBy: { sortOrder: 'asc' },
      }));
    if (!plan) return null;
    const startsAt = new Date();
    const endsAt = addDays(startsAt, plan.trialDays || 14);
    const sub = await this.prisma.tenantSubscription.create({
      data: {
        tenantId,
        planId: plan.id,
        billingCycle: BillingCycle.YEARLY,
        status: SubscriptionStatus.TRIAL,
        startsAt,
        endsAt,
        amountInr: 0,
        paymentMethod: SubPaymentMethod.MANUAL,
      },
    });
    await this.syncTenantLimits(tenantId, plan, SubscriptionStatus.TRIAL);
    return sub;
  }

  private async syncTenantLimits(
    tenantId: string,
    plan: { code: string; maxUsers: number; maxInvoices: number },
    status: SubscriptionStatus,
  ) {
    const tenantStatus =
      status === SubscriptionStatus.ACTIVE
        ? TenantStatus.ACTIVE
        : status === SubscriptionStatus.TRIAL
          ? TenantStatus.TRIAL
          : status === SubscriptionStatus.EXPIRED ||
              status === SubscriptionStatus.CANCELLED
            ? TenantStatus.SUSPENDED
            : undefined;

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        planCode: plan.code,
        maxUsers: plan.maxUsers,
        maxInvoices: plan.maxInvoices,
        ...(tenantStatus ? { status: tenantStatus } : {}),
      },
    });
  }

  // ── Tenant billing ─────────────────────────────────────

  async getTenantSubscription(tenantId: string) {
    const sub = await this.prisma.tenantSubscription.findFirst({
      where: {
        tenantId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
    });
    const invoiceCount = await this.prisma.invoice.count({
      where: { tenantId, deletedAt: null },
    });
    const userCount = await this.prisma.user.count({
      where: { tenantId, isActive: true },
    });
    const paymentMode = await this.getPublicPaymentMode();
    return {
      subscription: sub,
      tenant: {
        planCode: tenant.planCode,
        maxUsers: tenant.maxUsers,
        maxInvoices: tenant.maxInvoices,
        status: tenant.status,
      },
      usage: { invoices: invoiceCount, users: userCount },
      paymentMode,
    };
  }

  async checkout(actor: AuthUser, dto: CheckoutDto) {
    const plan = await this.getPlan(dto.planId);
    if (!plan.isActive || plan.isCustom) {
      throw new BadRequestException('Plan not available for self-serve checkout');
    }
    const amount =
      dto.billingCycle === BillingCycle.YEARLY
        ? plan.priceYearlyInr
        : plan.priceMonthlyInr;
    const mode = await this.getPublicPaymentMode();

    if (mode.mode === 'manual') {
      const order = await this.prisma.paymentOrder.create({
        data: {
          tenantId: actor.tenantId,
          planId: plan.id,
          billingCycle: dto.billingCycle,
          amountInr: amount,
          provider: PaymentProvider.MANUAL,
          status: PaymentOrderStatus.CREATED,
        },
      });
      return {
        mode: 'manual' as const,
        orderId: order.id,
        amountInr: amount,
        plan,
        billingCycle: dto.billingCycle,
        instructions: {
          upiId: mode.manualUpiId,
          bankDetails: mode.manualBankDetails,
          message:
            'Pay via UPI/NEFT and share the UTR with Platform Admin, or submit an enquiry. Your plan will be activated after confirmation.',
        },
      };
    }

    const settings = await this.ensurePaymentSettings();
    const keySecret = decryptSecret(settings.razorpayKeySecretEnc!);
    const keyId = settings.razorpayKeyId!;

    const rzOrder = await this.createRazorpayOrder({
      keyId,
      keySecret,
      amountPaise: amount * 100,
      receipt: `sub_${actor.tenantId.slice(0, 8)}_${Date.now()}`,
      notes: {
        tenantId: actor.tenantId,
        planId: plan.id,
        billingCycle: dto.billingCycle,
      },
    });

    const order = await this.prisma.paymentOrder.create({
      data: {
        tenantId: actor.tenantId,
        planId: plan.id,
        billingCycle: dto.billingCycle,
        amountInr: amount,
        provider: PaymentProvider.RAZORPAY,
        providerOrderId: rzOrder.id,
        status: PaymentOrderStatus.CREATED,
        rawPayload: rzOrder as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      mode: 'razorpay' as const,
      orderId: order.id,
      razorpayOrderId: rzOrder.id,
      amountInr: amount,
      amountPaise: amount * 100,
      currency: 'INR',
      keyId,
      plan,
      billingCycle: dto.billingCycle,
    };
  }

  async verifyCheckout(actor: AuthUser, dto: VerifyCheckoutDto) {
    const order = await this.prisma.paymentOrder.findFirst({
      where: {
        tenantId: actor.tenantId,
        OR: [{ id: dto.orderId }, { providerOrderId: dto.orderId }],
      },
      include: { plan: true },
    });
    if (!order) throw new NotFoundException('Payment order not found');
    if (order.status === PaymentOrderStatus.PAID) {
      return this.getTenantSubscription(actor.tenantId);
    }

    const settings = await this.ensurePaymentSettings();
    if (!settings.razorpayKeySecretEnc) {
      throw new BadRequestException('Gateway not configured');
    }
    const keySecret = decryptSecret(settings.razorpayKeySecretEnc);
    const orderIdForSig = order.providerOrderId ?? dto.orderId;
    const expected = createHmac('sha256', keySecret)
      .update(`${orderIdForSig}|${dto.paymentId}`)
      .digest('hex');
    if (!this.signaturesMatch(expected, dto.signature)) {
      throw new BadRequestException('Invalid payment signature');
    }

    await this.activatePaidOrder(order.id, dto.paymentId, {
      verify: dto,
    });
    return this.getTenantSubscription(actor.tenantId);
  }

  async handleRazorpayWebhook(rawBody: Buffer, signature: string | undefined) {
    const settings = await this.ensurePaymentSettings();
    if (!settings.razorpayWebhookSecretEnc) {
      throw new BadRequestException('Webhook secret not configured');
    }
    if (!signature) throw new BadRequestException('Missing signature');
    const secret = decryptSecret(settings.razorpayWebhookSecretEnc);
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    if (!this.signaturesMatch(expected, signature)) {
      throw new ForbiddenException('Invalid webhook signature');
    }
    const payload = JSON.parse(rawBody.toString('utf8')) as {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            status?: string;
          };
        };
      };
    };
    if (payload.event === 'payment.captured' || payload.event === 'order.paid') {
      const payment = payload.payload?.payment?.entity;
      if (payment?.order_id && payment?.id) {
        const order = await this.prisma.paymentOrder.findUnique({
          where: { providerOrderId: payment.order_id },
        });
        if (order && order.status !== PaymentOrderStatus.PAID) {
          await this.activatePaidOrder(order.id, payment.id, payload);
        }
      }
    }
    return { ok: true };
  }

  private async activatePaidOrder(
    orderId: string,
    paymentId: string,
    raw: unknown,
  ) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id: orderId },
      include: { plan: true },
    });
    if (!order) return;

    const startsAt = new Date();
    const endsAt = addDays(
      startsAt,
      order.billingCycle === BillingCycle.YEARLY ? 365 : 30,
    );

    await this.prisma.tenantSubscription.updateMany({
      where: {
        tenantId: order.tenantId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
      },
      data: { status: SubscriptionStatus.CANCELLED },
    });

    const sub = await this.prisma.tenantSubscription.create({
      data: {
        tenantId: order.tenantId,
        planId: order.planId,
        billingCycle: order.billingCycle,
        status: SubscriptionStatus.ACTIVE,
        startsAt,
        endsAt,
        amountInr: order.amountInr,
        paymentMethod: SubPaymentMethod.RAZORPAY,
        paymentRef: paymentId,
      },
    });

    await this.prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: PaymentOrderStatus.PAID,
        providerPaymentId: paymentId,
        subscriptionId: sub.id,
        rawPayload: raw as Prisma.InputJsonValue,
      },
    });

    await this.syncTenantLimits(
      order.tenantId,
      order.plan,
      SubscriptionStatus.ACTIVE,
    );
    await this.audit.log({
      tenantId: order.tenantId,
      action: 'SUBSCRIPTION_PAID',
      entityType: 'PaymentOrder',
      entityId: order.id,
      meta: { paymentId, planCode: order.plan.code },
    });
  }

  private signaturesMatch(a: string, b: string): boolean {
    try {
      const ba = Buffer.from(a);
      const bb = Buffer.from(b);
      if (ba.length !== bb.length) return false;
      return timingSafeEqual(ba, bb);
    } catch {
      return false;
    }
  }

  private async createRazorpayOrder(opts: {
    keyId: string;
    keySecret: string;
    amountPaise: number;
    receipt: string;
    notes: Record<string, string>;
  }) {
    const auth = Buffer.from(`${opts.keyId}:${opts.keySecret}`).toString('base64');
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: opts.amountPaise,
        currency: 'INR',
        receipt: opts.receipt.slice(0, 40),
        notes: opts.notes,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`Razorpay order failed: ${text}`);
    }
    return res.json() as Promise<{ id: string; amount: number; currency: string }>;
  }

  // ── Analytics / orders ─────────────────────────────────

  listPaymentOrders() {
    return this.prisma.paymentOrder.findMany({
      include: {
        plan: true,
        tenant: { select: { id: true, clientId: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async billingAnalytics() {
    const now = new Date();
    const week = addDays(now, 7);
    const [active, trial, expiredSoon, plans, paidOrders] = await Promise.all([
      this.prisma.tenantSubscription.count({
        where: { status: SubscriptionStatus.ACTIVE },
      }),
      this.prisma.tenantSubscription.count({
        where: { status: SubscriptionStatus.TRIAL },
      }),
      this.prisma.tenantSubscription.count({
        where: {
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
          endsAt: { lte: week },
        },
      }),
      this.prisma.tenantSubscription.groupBy({
        by: ['planId'],
        where: { status: SubscriptionStatus.ACTIVE },
        _count: true,
        _sum: { amountInr: true },
      }),
      this.prisma.paymentOrder.findMany({
        where: { status: PaymentOrderStatus.PAID },
        select: { amountInr: true, billingCycle: true },
      }),
    ]);

    const activeSubs = await this.prisma.tenantSubscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE },
      select: { amountInr: true, billingCycle: true, planId: true },
    });
    let mrr = 0;
    for (const s of activeSubs) {
      mrr +=
        s.billingCycle === BillingCycle.YEARLY
          ? Math.round(s.amountInr / 12)
          : s.amountInr;
    }

    const planRows = await this.prisma.subscriptionPlan.findMany({
      where: { id: { in: plans.map((p) => p.planId) } },
    });
    const planMix = plans.map((p) => ({
      planId: p.planId,
      code: planRows.find((x) => x.id === p.planId)?.code ?? p.planId,
      count: p._count,
      revenueInr: p._sum.amountInr ?? 0,
    }));

    return {
      activePaid: active,
      trials: trial,
      expiringIn7Days: expiredSoon,
      mrrInr: mrr,
      arrInr: mrr * 12,
      planMix,
      paidOrderCount: paidOrders.length,
      paidVolumeInr: paidOrders.reduce((s, o) => s + o.amountInr, 0),
    };
  }

  /** Call before creating invoices — throws if subscription invalid or over limit */
  async assertCanCreateInvoice(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (tenant.clientId === 'PLATFORM') return;
    if (tenant.status === TenantStatus.SUSPENDED) {
      throw new ForbiddenException('Tenant suspended. Contact Platform Admin.');
    }

    const sub = await this.prisma.tenantSubscription.findFirst({
      where: {
        tenantId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (sub && sub.endsAt < new Date()) {
      await this.prisma.tenantSubscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.EXPIRED },
      });
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { status: TenantStatus.SUSPENDED },
      });
      throw new ForbiddenException(
        'Subscription expired. Renew from Billing or contact Platform Admin.',
      );
    }

    if (!sub && tenant.status === TenantStatus.TRIAL) {
      // legacy tenants without subscription row — allow until admin assigns
    } else if (!sub && tenant.status !== TenantStatus.ACTIVE) {
      throw new ForbiddenException(
        'No active subscription. Contact Platform Admin to activate your plan.',
      );
    }

    const count = await this.prisma.invoice.count({
      where: { tenantId, deletedAt: null },
    });
    if (count >= tenant.maxInvoices) {
      throw new ForbiddenException(
        `Invoice limit reached (${tenant.maxInvoices}). Upgrade your plan.`,
      );
    }
  }

  /**
   * Feature codes stored in plan.features (alongside marketing labels):
   * whatsapp | csvImport | smtp | stock | partialPay | creditNotes | notes | eway | pos
   */
  async hasFeature(tenantId: string, feature: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || tenant.clientId === 'PLATFORM') return true;
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { code: tenant.planCode },
    });
    if (!plan) return true; // legacy
    const feats = Array.isArray(plan.features)
      ? (plan.features as string[])
      : [];
    if (feats.includes(feature)) return true;
    // Growth+ inherit: BUSINESS / ENTERPRISE get all growth codes
    if (plan.code === 'BUSINESS' || plan.code === 'ENTERPRISE') {
      const growthDefaults = [
        'whatsapp',
        'csvImport',
        'smtp',
        'stock',
        'partialPay',
        'creditNotes',
        'notes',
        'eway',
        'pos',
      ];
      if (growthDefaults.includes(feature)) return true;
    }
    if (plan.code === 'GROWTH') {
      const growth = [
        'whatsapp',
        'csvImport',
        'smtp',
        'partialPay',
        'notes',
        'pos',
      ];
      if (growth.includes(feature)) return true;
    }
    return false;
  }

  async assertFeature(tenantId: string, feature: string, label?: string) {
    const ok = await this.hasFeature(tenantId, feature);
    if (!ok) {
      throw new ForbiddenException(
        `${label ?? feature} is not included in your plan. Upgrade from Billing.`,
      );
    }
  }

  async tenantFeatures(tenantId: string) {
    const codes = [
      'whatsapp',
      'csvImport',
      'smtp',
      'stock',
      'partialPay',
      'creditNotes',
      'notes',
      'eway',
      'pos',
    ] as const;
    const out: Record<string, boolean> = {};
    for (const c of codes) {
      out[c] = await this.hasFeature(tenantId, c);
    }
    return out;
  }
}
