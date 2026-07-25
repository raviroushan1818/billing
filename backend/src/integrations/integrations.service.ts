import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { decryptSecret, encryptSecret } from '../common/crypto.util';
import { TestEmailDto, UpsertIntegrationsDto } from './dto/integrations.dto';

export type MaskedIntegrations = {
  id: string | null;
  tenantId: string;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpSecure: boolean;
  smtpFromEmail: string | null;
  smtpFromName: string | null;
  hasSmtpPass: boolean;
  waPhoneNumberId: string | null;
  waApiVersion: string;
  hasWaToken: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
};

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(tenantId: string): Promise<MaskedIntegrations> {
    const row = await this.prisma.tenantIntegrationSettings.findUnique({
      where: { tenantId },
    });
    return this.mask(tenantId, row);
  }

  async upsert(
    actor: AuthUser,
    dto: UpsertIntegrationsDto,
  ): Promise<MaskedIntegrations> {
    const existing = await this.prisma.tenantIntegrationSettings.findUnique({
      where: { tenantId: actor.tenantId },
    });

    const data: Prisma.TenantIntegrationSettingsUncheckedCreateInput = {
      tenantId: actor.tenantId,
      smtpHost: dto.smtpHost === undefined ? existing?.smtpHost : dto.smtpHost,
      smtpPort: dto.smtpPort === undefined ? existing?.smtpPort : dto.smtpPort,
      smtpUser: dto.smtpUser === undefined ? existing?.smtpUser : dto.smtpUser,
      smtpSecure:
        dto.smtpSecure === undefined
          ? (existing?.smtpSecure ?? true)
          : dto.smtpSecure,
      smtpFromEmail:
        dto.smtpFromEmail === undefined
          ? existing?.smtpFromEmail
          : dto.smtpFromEmail,
      smtpFromName:
        dto.smtpFromName === undefined
          ? existing?.smtpFromName
          : dto.smtpFromName,
      waPhoneNumberId:
        dto.waPhoneNumberId === undefined
          ? existing?.waPhoneNumberId
          : dto.waPhoneNumberId,
      waApiVersion:
        dto.waApiVersion === undefined
          ? (existing?.waApiVersion ?? 'v19.0')
          : dto.waApiVersion,
      smtpPassEnc: existing?.smtpPassEnc ?? null,
      waAccessTokenEnc: existing?.waAccessTokenEnc ?? null,
    };

    if (dto.smtpPass !== undefined && dto.smtpPass !== null) {
      data.smtpPassEnc =
        dto.smtpPass === '' ? null : encryptSecret(dto.smtpPass);
    }
    if (dto.waAccessToken !== undefined && dto.waAccessToken !== null) {
      data.waAccessTokenEnc =
        dto.waAccessToken === '' ? null : encryptSecret(dto.waAccessToken);
    }

    const { tenantId: _tenantId, ...updateData } = data;
    void _tenantId;

    const row = await this.prisma.tenantIntegrationSettings.upsert({
      where: { tenantId: actor.tenantId },
      create: data,
      update: updateData,
    });

    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'INTEGRATIONS_UPDATED',
      entityType: 'TenantIntegrationSettings',
      entityId: row.id,
      meta: {
        smtpConfigured: Boolean(row.smtpHost && row.smtpPassEnc),
        waConfigured: Boolean(row.waPhoneNumberId && row.waAccessTokenEnc),
      },
    });

    return this.mask(actor.tenantId, row);
  }

  async testEmail(actor: AuthUser, dto: TestEmailDto) {
    const settings = await this.requireSmtp(actor.tenantId);
    const transport = this.createTransport(settings);
    const from = this.formatFrom(settings);

    try {
      await transport.sendMail({
        from,
        to: dto.to,
        subject: 'Billing — SMTP test',
        text: 'This is a test email from your billing integrations settings.',
        html: '<p>This is a test email from your billing integrations settings.</p>',
      });
    } catch (err) {
      this.logger.warn(
        `SMTP test failed for tenant ${actor.tenantId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw new BadRequestException(
        `Failed to send test email: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    await this.audit.log({
      tenantId: actor.tenantId,
      userId: actor.userId,
      action: 'INTEGRATIONS_TEST_EMAIL',
      entityType: 'TenantIntegrationSettings',
      entityId: settings.id,
      meta: { to: dto.to },
    });

    return { ok: true, to: dto.to };
  }

  async sendInvoiceEmail(opts: {
    tenantId: string;
    to: string;
    subject: string;
    text: string;
    html?: string;
    filename: string;
    pdfBuffer: Buffer;
  }) {
    const settings = await this.requireSmtp(opts.tenantId);
    const transport = this.createTransport(settings);
    const from = this.formatFrom(settings);

    try {
      await transport.sendMail({
        from,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
        attachments: [
          {
            filename: opts.filename,
            content: opts.pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });
    } catch (err) {
      this.logger.warn(
        `Invoice email failed for tenant ${opts.tenantId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw new BadRequestException(
        `Failed to send email: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async sendWhatsappDocument(opts: {
    tenantId: string;
    toE164: string;
    caption: string;
    filename: string;
    pdfBuffer: Buffer;
  }) {
    const settings = await this.requireWhatsapp(opts.tenantId);
    const token = decryptSecret(settings.waAccessTokenEnc!);
    const version = settings.waApiVersion || 'v19.0';
    const phoneNumberId = settings.waPhoneNumberId!;
    const to = opts.toE164.replace(/[^\d]/g, '');

    if (!to) {
      throw new BadRequestException('Invalid WhatsApp recipient number');
    }

    const mediaId = await this.uploadWhatsappMedia({
      version,
      phoneNumberId,
      token,
      filename: opts.filename,
      pdfBuffer: opts.pdfBuffer,
    });

    const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'document',
        document: {
          id: mediaId,
          caption: opts.caption.slice(0, 1024),
          filename: opts.filename,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.warn(`WhatsApp send failed: ${res.status} ${body}`);
      throw new BadRequestException(
        `WhatsApp send failed (${res.status}): ${body}`,
      );
    }

    return res.json() as Promise<unknown>;
  }

  private async uploadWhatsappMedia(opts: {
    version: string;
    phoneNumberId: string;
    token: string;
    filename: string;
    pdfBuffer: Buffer;
  }): Promise<string> {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', 'application/pdf');
    form.append(
      'file',
      new Blob([new Uint8Array(opts.pdfBuffer)], { type: 'application/pdf' }),
      opts.filename,
    );

    const url = `https://graph.facebook.com/${opts.version}/${opts.phoneNumberId}/media`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${opts.token}` },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text();
      this.logger.warn(`WhatsApp media upload failed: ${res.status} ${body}`);
      throw new BadRequestException(
        `WhatsApp media upload failed (${res.status}): ${body}`,
      );
    }

    const json = (await res.json()) as { id?: string };
    if (!json.id) {
      throw new BadRequestException('WhatsApp media upload returned no id');
    }
    return json.id;
  }

  private async requireSmtp(tenantId: string) {
    const settings = await this.prisma.tenantIntegrationSettings.findUnique({
      where: { tenantId },
    });
    if (
      !settings?.smtpHost ||
      !settings.smtpPort ||
      !settings.smtpFromEmail ||
      !settings.smtpPassEnc
    ) {
      throw new BadRequestException(
        'SMTP is not configured. Configure Email settings under Integrations.',
      );
    }
    return settings;
  }

  private async requireWhatsapp(tenantId: string) {
    const settings = await this.prisma.tenantIntegrationSettings.findUnique({
      where: { tenantId },
    });
    if (!settings?.waPhoneNumberId || !settings.waAccessTokenEnc) {
      throw new BadRequestException(
        'WhatsApp is not configured. Configure WhatsApp Cloud API credentials under Integrations.',
      );
    }
    return settings;
  }

  private createTransport(
    settings: Awaited<ReturnType<IntegrationsService['requireSmtp']>>,
  ) {
    const pass = decryptSecret(settings.smtpPassEnc!);
    return nodemailer.createTransport({
      host: settings.smtpHost!,
      port: settings.smtpPort!,
      secure: settings.smtpSecure,
      auth: settings.smtpUser
        ? { user: settings.smtpUser, pass }
        : undefined,
    });
  }

  private formatFrom(
    settings: Awaited<ReturnType<IntegrationsService['requireSmtp']>>,
  ): string {
    const email = settings.smtpFromEmail!;
    if (settings.smtpFromName) {
      return `"${settings.smtpFromName.replace(/"/g, '')}" <${email}>`;
    }
    return email;
  }

  private mask(
    tenantId: string,
    row: {
      id: string;
      smtpHost: string | null;
      smtpPort: number | null;
      smtpUser: string | null;
      smtpPassEnc: string | null;
      smtpSecure: boolean;
      smtpFromEmail: string | null;
      smtpFromName: string | null;
      waPhoneNumberId: string | null;
      waAccessTokenEnc: string | null;
      waApiVersion: string;
      createdAt: Date;
      updatedAt: Date;
    } | null,
  ): MaskedIntegrations {
    if (!row) {
      return {
        id: null,
        tenantId,
        smtpHost: null,
        smtpPort: null,
        smtpUser: null,
        smtpSecure: true,
        smtpFromEmail: null,
        smtpFromName: null,
        hasSmtpPass: false,
        waPhoneNumberId: null,
        waApiVersion: 'v19.0',
        hasWaToken: false,
        createdAt: null,
        updatedAt: null,
      };
    }

    return {
      id: row.id,
      tenantId,
      smtpHost: row.smtpHost,
      smtpPort: row.smtpPort,
      smtpUser: row.smtpUser,
      smtpSecure: row.smtpSecure,
      smtpFromEmail: row.smtpFromEmail,
      smtpFromName: row.smtpFromName,
      hasSmtpPass: Boolean(row.smtpPassEnc),
      waPhoneNumberId: row.waPhoneNumberId,
      waApiVersion: row.waApiVersion,
      hasWaToken: Boolean(row.waAccessTokenEnc),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
