import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { InvoicesService } from '../invoices/invoices.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { hashApiKey } from './hms-api-key.guard';
import { CreateInvoiceDto } from '../invoices/dto/invoice.dto';

@Injectable()
export class HmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    @Inject(forwardRef(() => InvoicesService))
    private readonly invoices: InvoicesService,
    private readonly config: ConfigService,
  ) {}

  async issueApiKey(actor: AuthUser, hmsBaseUrl?: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: actor.tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const bridgeUser = await this.ensureBridgeUser(tenant.id);
    const rawKey = `hms_${randomBytes(24).toString('base64url')}`;
    const webhookSecret = randomBytes(24).toString('base64url');

    await this.prisma.tenantIntegrationSettings.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        hmsApiKeyHash: hashApiKey(rawKey),
        hmsApiKeyPrefix: rawKey.slice(0, 12),
        hmsWebhookSecret: webhookSecret,
        hmsBaseUrl: hmsBaseUrl?.trim() || null,
        hmsBridgeUserId: bridgeUser.id,
      },
      update: {
        hmsApiKeyHash: hashApiKey(rawKey),
        hmsApiKeyPrefix: rawKey.slice(0, 12),
        hmsWebhookSecret: webhookSecret,
        hmsBaseUrl: hmsBaseUrl?.trim() || undefined,
        hmsBridgeUserId: bridgeUser.id,
      },
    });

    return {
      clientId: tenant.clientId,
      apiKey: rawKey,
      webhookSecret,
      bridgeUserEmail: bridgeUser.email,
      message:
        'Store the API key now — it will not be shown again. Configure IndHMS with this Client ID and key.',
    };
  }

  async getHmsStatus(tenantId: string) {
    const row = await this.prisma.tenantIntegrationSettings.findUnique({
      where: { tenantId },
    });
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    return {
      linked: Boolean(row?.hmsApiKeyHash),
      clientId: tenant?.clientId,
      apiKeyPrefix: row?.hmsApiKeyPrefix || null,
      hmsBaseUrl: row?.hmsBaseUrl || null,
      hasWebhookSecret: Boolean(row?.hmsWebhookSecret),
    };
  }

  private async ensureBridgeUser(tenantId: string) {
    const email = 'hms-bridge@system.local';
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (existing) {
      if (!existing.isActive) {
        return this.prisma.user.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
      }
      return existing;
    }
    const password = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
    return this.prisma.user.create({
      data: {
        tenantId,
        email,
        password,
        firstName: 'HMS',
        lastName: 'Bridge',
        role: 'BILLING_OPERATOR',
        isActive: true,
      },
    });
  }

  async exchangeApiKeyForJwt(clientId: string, apiKey: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { clientId: clientId.trim().toUpperCase() },
      include: { integrations: true },
    });
    if (!tenant?.integrations?.hmsApiKeyHash) {
      throw new UnauthorizedException('Invalid HMS credentials');
    }
    if (tenant.integrations.hmsApiKeyHash !== hashApiKey(apiKey)) {
      throw new UnauthorizedException('Invalid HMS credentials');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: tenant.integrations.hmsBridgeUserId || '' },
      include: { tenant: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('HMS bridge user missing');
    }
    return this.auth.issueTokenForUser(user);
  }

  /**
   * IndHMS signs a short-lived SSO payload with the shared webhook/SSO secret.
   * Payload: { clientId, email?, name?, role?, userId?, exp, iat, redirect? }
   */
  async exchangeSsoToken(token: string) {
    let payload: {
      clientId: string;
      email?: string;
      name?: string;
      role?: string;
      userId?: string;
      exp: number;
      redirect?: string;
    };
    try {
      payload = JSON.parse(
        Buffer.from(token.split('.')[0], 'base64url').toString('utf8'),
      );
    } catch {
      throw new UnauthorizedException('Invalid SSO token');
    }

    const clientId = String(payload.clientId || '')
      .trim()
      .toUpperCase();
    const tenant = await this.prisma.tenant.findUnique({
      where: { clientId },
      include: { integrations: true },
    });
    if (!tenant?.integrations?.hmsWebhookSecret) {
      throw new UnauthorizedException('SSO not configured for tenant');
    }
    if (!payload.exp || payload.exp * 1000 < Date.now()) {
      throw new UnauthorizedException('SSO token expired');
    }

    const [bodyB64, sig] = token.split('.');
    if (!bodyB64 || !sig) throw new UnauthorizedException('Invalid SSO token');
    const expected = createHmac('sha256', tenant.integrations.hmsWebhookSecret)
      .update(bodyB64)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid SSO signature');
    }

    // Prefer a shadow user named for the IndHMS operator (raised / finalized attribution)
    let user =
      payload.name || payload.userId
        ? await this.ensureRaisedByUser(tenant.id, {
            name: payload.name,
            email: payload.email,
            role: payload.role,
            userId: payload.userId,
          })
        : null;

    if (!user) {
      const email = (payload.email || 'hms-bridge@system.local').toLowerCase();
      user = await this.prisma.user.findUnique({
        where: { tenantId_email: { tenantId: tenant.id, email } },
      });
    }
    if (!user) {
      user = await this.prisma.user.findUnique({
        where: {
          tenantId_email: {
            tenantId: tenant.id,
            email: 'hms-bridge@system.local',
          },
        },
      });
    }
    if (!user || !user.isActive) {
      throw new UnauthorizedException('No billing user for SSO');
    }

    const withTenant = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: { tenant: true },
    });
    if (!withTenant) throw new UnauthorizedException('No billing user for SSO');

    const auth = this.auth.issueTokenForUser(withTenant);
    return {
      ...auth,
      redirect: payload.redirect || '/app/bills',
    };
  }

  async upsertParty(
    actor: AuthUser,
    dto: {
      externalId: string;
      name: string;
      phone?: string;
      email?: string;
      address?: string;
      customFields?: Record<string, unknown>;
    },
  ) {
    const externalId = String(dto.externalId || '').trim();
    if (!externalId) throw new BadRequestException('externalId (UHID) required');
    const existing = await this.prisma.party.findFirst({
      where: { tenantId: actor.tenantId, externalId },
    });
    if (existing) {
      return this.prisma.party.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          phone: dto.phone,
          email: dto.email?.toLowerCase(),
          address: dto.address,
          customFields: (dto.customFields ??
            existing.customFields) as Prisma.InputJsonValue,
          isActive: true,
        },
      });
    }
    return this.prisma.party.create({
      data: {
        tenantId: actor.tenantId,
        externalId,
        name: dto.name,
        phone: dto.phone,
        email: dto.email?.toLowerCase(),
        address: dto.address,
        customFields: (dto.customFields ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async upsertItem(
    actor: AuthUser,
    dto: {
      barcode: string;
      name: string;
      rate: number;
      gstRate?: number;
      unit?: string;
      hsnSac?: string;
      description?: string;
    },
  ) {
    const barcode = String(dto.barcode || '').trim();
    if (!barcode) throw new BadRequestException('barcode (item code) required');
    const existing = await this.prisma.itemMaster.findFirst({
      where: { tenantId: actor.tenantId, barcode },
    });
    if (existing) {
      return this.prisma.itemMaster.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          rate: dto.rate,
          gstRate: dto.gstRate ?? Number(existing.gstRate),
          unit: dto.unit || existing.unit,
          hsnSac: dto.hsnSac ?? existing.hsnSac,
          description: dto.description ?? existing.description,
          isActive: true,
        },
      });
    }
    return this.prisma.itemMaster.create({
      data: {
        tenantId: actor.tenantId,
        barcode,
        name: dto.name,
        rate: dto.rate,
        gstRate: dto.gstRate ?? 0,
        unit: dto.unit || 'NOS',
        hsnSac: dto.hsnSac,
        description: dto.description,
        trackStock: false,
      },
    });
  }

  private indhmsRoleLabel(role?: string): string {
    switch (String(role || '')
      .trim()
      .toLowerCase()) {
      case 'hospital_admin':
        return 'Hospital admin';
      case 'billing':
        return 'Billing';
      case 'reception':
        return 'Reception';
      case 'doctor':
        return 'Doctor';
      case 'nurse':
        return 'Nurse';
      case 'lab':
        return 'Lab';
      case 'pharmacy':
        return 'Pharmacy';
      default:
        return role ? String(role) : 'IndHMS';
    }
  }

  private mapIndhmsRole(
    role?: string,
  ): 'CLIENT_ADMIN' | 'BILLING_OPERATOR' {
    return String(role || '')
      .trim()
      .toLowerCase() === 'hospital_admin'
      ? 'CLIENT_ADMIN'
      : 'BILLING_OPERATOR';
  }

  /** Shadow billing user so Raised-by shows IndHMS name + role. */
  private async ensureRaisedByUser(
    tenantId: string,
    raisedBy: {
      name?: string;
      email?: string;
      role?: string;
      userId?: string;
    },
  ) {
    const name = String(raisedBy.name || 'IndHMS user').trim() || 'IndHMS user';
    const roleLabel = this.indhmsRoleLabel(raisedBy.role);
    const billingRole = this.mapIndhmsRole(raisedBy.role);
    const email = (
      raisedBy.userId
        ? `hms.${raisedBy.userId}@indhms.bridge`
        : raisedBy.email
          ? `hms.${String(raisedBy.email).toLowerCase().replace(/[^a-z0-9._-]/g, '_')}@indhms.bridge`
          : `hms.anon.${hashApiKey(name + roleLabel).slice(0, 12)}@indhms.bridge`
    ).toLowerCase();

    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: {
          firstName: name,
          lastName: roleLabel,
          role: billingRole,
          isActive: true,
        },
      });
    }
    const password = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
    return this.prisma.user.create({
      data: {
        tenantId,
        email,
        password,
        firstName: name,
        lastName: roleLabel,
        role: billingRole,
        isActive: true,
      },
    });
  }

  async upsertEncounterInvoice(
    actor: AuthUser,
    dto: CreateInvoiceDto & {
      externalRef: string;
      raisedBy?: {
        name?: string;
        email?: string;
        role?: string;
        userId?: string;
      };
    },
  ) {
    const externalRef = String(dto.externalRef || '').trim();
    if (!externalRef) throw new BadRequestException('externalRef required');
    if (!dto.lines?.length) {
      throw new BadRequestException('At least one invoice line required');
    }

    const existing = await this.prisma.invoice.findFirst({
      where: {
        tenantId: actor.tenantId,
        externalRef,
        deletedAt: null,
      },
    });

    let partyId = dto.partyId;
    if (!partyId && dto.partyExternalId) {
      const party = await this.prisma.party.findFirst({
        where: {
          tenantId: actor.tenantId,
          externalId: String(dto.partyExternalId).trim(),
        },
      });
      partyId = party?.id;
    }

    const { raisedBy, ...invoiceFields } = dto;
    let createActor = actor;
    let raisedByUserId: string | null = null;
    if (raisedBy?.name || raisedBy?.userId || raisedBy?.email) {
      const raisedUser = await this.ensureRaisedByUser(actor.tenantId, raisedBy);
      raisedByUserId = raisedUser.id;
      createActor = {
        ...actor,
        userId: raisedUser.id,
        email: raisedUser.email,
        role: raisedUser.role,
      };
    }

    const payload: CreateInvoiceDto = {
      ...invoiceFields,
      partyId,
      finalize: false,
      notes: invoiceFields.notes || `IndHMS encounter ${externalRef}`,
    };

    if (!existing) {
      const created = await this.invoices.create(createActor, payload);
      await this.prisma.invoice.update({
        where: { id: created.id },
        data: {
          externalRef,
          ...(raisedByUserId ? { createdById: raisedByUserId } : {}),
        },
      });
      return this.invoices.get(actor.tenantId, created.id);
    }

    if (existing.status === 'DRAFT') {
      await this.invoices.updateDraft(createActor, existing.id, payload);
      if (raisedByUserId) {
        await this.prisma.invoice.update({
          where: { id: existing.id },
          data: { createdById: raisedByUserId },
        });
      }
      return this.invoices.get(actor.tenantId, existing.id);
    }

    // Finalized: keep lines, but refresh IndHMS attribution when provided
    if (raisedByUserId && existing.createdById !== raisedByUserId) {
      await this.prisma.invoice.update({
        where: { id: existing.id },
        data: { createdById: raisedByUserId },
      });
    }
    return this.invoices.get(actor.tenantId, existing.id);
  }

  async getByExternalRef(actor: AuthUser, externalRef: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: {
        tenantId: actor.tenantId,
        externalRef: String(externalRef).trim(),
        deletedAt: null,
      },
    });
    if (!inv) throw new NotFoundException('Invoice not found for externalRef');
    return this.invoices.get(actor.tenantId, inv.id);
  }

  async notifyHmsPayment(invoiceId: string, tenantId: string) {
    const settings = await this.prisma.tenantIntegrationSettings.findUnique({
      where: { tenantId },
    });
    if (!settings?.hmsBaseUrl || !settings.hmsWebhookSecret) return;

    const invoice = await this.invoices.get(tenantId, invoiceId);
    const body = {
      event: 'INVOICE_PAYMENT',
      invoiceId: invoice.id,
      billNo: invoice.billNo,
      externalRef: (invoice as { externalRef?: string | null }).externalRef || null,
      partyExternalId: invoice.partyExternalId,
      grandTotal: Number(invoice.grandTotal),
      amountPaid: Number(invoice.amountPaid),
      balanceDue: Number(invoice.balanceDue),
      paymentStatus: invoice.paymentStatus,
      status: invoice.status,
      at: new Date().toISOString(),
    };
    const raw = JSON.stringify(body);
    const signature = createHmac('sha256', settings.hmsWebhookSecret)
      .update(raw)
      .digest('hex');

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const url = `${settings.hmsBaseUrl.replace(/\/$/, '')}/api/billing/bridge/webhook`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Billing-Signature': signature,
          'X-Billing-Client-Id': tenant?.clientId || '',
        },
        body: raw,
      });
    } catch {
      // best-effort; IndHMS can poll
    }
  }
}
