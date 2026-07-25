import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InquiryStatus } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInquiryDto } from './dto/inquiry.dto';

@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async createInquiry(dto: CreateInquiryDto) {
    const inquiry = await this.prisma.platformInquiry.create({
      data: {
        name: dto.name.trim(),
        businessName: dto.businessName.trim(),
        phone: dto.phone.trim(),
        email: dto.email.toLowerCase().trim(),
        message: dto.message.trim(),
      },
    });

    void this.notifyAdmin(inquiry).catch((err) => {
      this.logger.warn(`Inquiry email notify failed: ${String(err)}`);
    });

    return {
      ok: true,
      id: inquiry.id,
      message: 'Thank you. Our platform team will contact you shortly.',
    };
  }

  listInquiries(status?: InquiryStatus) {
    return this.prisma.platformInquiry.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateInquiryStatus(id: string, status: InquiryStatus) {
    return this.prisma.platformInquiry.update({
      where: { id },
      data: { status },
    });
  }

  private async notifyAdmin(inquiry: {
    id: string;
    name: string;
    businessName: string;
    phone: string;
    email: string;
    message: string;
  }) {
    const to = this.config.get<string>('PLATFORM_NOTIFY_EMAIL')?.trim();
    const host = this.config.get<string>('PLATFORM_SMTP_HOST')?.trim();
    const user = this.config.get<string>('PLATFORM_SMTP_USER')?.trim();
    const pass = this.config.get<string>('PLATFORM_SMTP_PASS')?.trim();
    if (!to || !host || !user || !pass) return;

    const port = Number(this.config.get<string>('PLATFORM_SMTP_PORT') ?? '587');
    const from =
      this.config.get<string>('PLATFORM_SMTP_FROM')?.trim() || user;
    const secure = port === 465;

    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    await transport.sendMail({
      from,
      to,
      subject: `New billing demo inquiry — ${inquiry.businessName}`,
      text: [
        `Name: ${inquiry.name}`,
        `Business: ${inquiry.businessName}`,
        `Phone: ${inquiry.phone}`,
        `Email: ${inquiry.email}`,
        '',
        inquiry.message,
        '',
        `Inquiry ID: ${inquiry.id}`,
      ].join('\n'),
    });
  }
}
