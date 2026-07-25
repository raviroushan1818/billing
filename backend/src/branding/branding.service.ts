import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaPurpose } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { sanitizeBrandingHtml } from '../common/html-sanitize.util';
import { UpdateBrandTemplateDto } from './dto/branding.dto';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
]);
const MAX_BYTES = 2 * 1024 * 1024;

export type BrandingView = {
  id: string;
  tenantId: string;
  logoGcsKey: string | null;
  letterhead: string | null;
  headerHtml: string;
  footerHtml: string;
  primaryColor: string;
  invoiceTitle: string;
  showGstin: boolean;
  logoWidthPx: number;
  bannerHeightPx: number;
  invoiceTheme: string;
  logoAlign: string;
  headerMode: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class BrandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  async get(tenantId: string): Promise<BrandingView> {
    const template = await this.prisma.brandTemplate.findUnique({
      where: { tenantId },
    });
    if (!template) throw new NotFoundException('Brand template not found');
    return this.toView(template);
  }

  async update(tenantId: string, dto: UpdateBrandTemplateDto): Promise<BrandingView> {
    const data: Record<string, unknown> = {};
    if (dto.logoGcsKey !== undefined) data.logoGcsKey = dto.logoGcsKey || null;
    if (dto.letterhead !== undefined) data.letterhead = dto.letterhead || null;
    if (dto.headerHtml !== undefined) {
      data.headerHtml = sanitizeBrandingHtml(dto.headerHtml);
    }
    if (dto.footerHtml !== undefined) {
      data.footerHtml = sanitizeBrandingHtml(dto.footerHtml);
    }
    if (dto.primaryColor !== undefined) data.primaryColor = dto.primaryColor;
    if (dto.invoiceTitle !== undefined) data.invoiceTitle = dto.invoiceTitle;
    if (dto.showGstin !== undefined) data.showGstin = dto.showGstin;
    if (dto.logoWidthPx !== undefined) data.logoWidthPx = dto.logoWidthPx;
    if (dto.bannerHeightPx !== undefined) data.bannerHeightPx = dto.bannerHeightPx;
    if (dto.invoiceTheme !== undefined) data.invoiceTheme = dto.invoiceTheme;
    if (dto.logoAlign !== undefined) data.logoAlign = dto.logoAlign;
    if (dto.headerMode !== undefined) data.headerMode = dto.headerMode;

    const template = await this.prisma.brandTemplate.update({
      where: { tenantId },
      data,
    });
    return this.toView(template);
  }

  async uploadLogo(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<BrandingView> {
    this.assertImage(file);
    const uploaded = await this.storage.uploadForPurpose(
      tenantId,
      MediaPurpose.LOGO,
      file.buffer,
      file.mimetype,
      file.originalname,
    );
    const template = await this.prisma.brandTemplate.update({
      where: { tenantId },
      data: { logoGcsKey: uploaded.gcsKey },
    });
    return this.toView(template);
  }

  async uploadBanner(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<BrandingView> {
    this.assertImage(file);
    const uploaded = await this.storage.uploadForPurpose(
      tenantId,
      MediaPurpose.LETTERHEAD,
      file.buffer,
      file.mimetype,
      file.originalname,
    );
    const template = await this.prisma.brandTemplate.update({
      where: { tenantId },
      data: { letterhead: uploaded.gcsKey },
    });
    return this.toView(template);
  }

  async removeLogo(tenantId: string): Promise<BrandingView> {
    const template = await this.prisma.brandTemplate.update({
      where: { tenantId },
      data: { logoGcsKey: null },
    });
    return this.toView(template);
  }

  async removeBanner(tenantId: string): Promise<BrandingView> {
    const template = await this.prisma.brandTemplate.update({
      where: { tenantId },
      data: { letterhead: null },
    });
    return this.toView(template);
  }

  /** Resolve a media key to a URL usable by the browser or Puppeteer. */
  async resolveMediaUrl(gcsKey: string | null | undefined): Promise<string | null> {
    if (!gcsKey) return null;

    const signed = await this.storage.getSignedUrl(gcsKey, 60);
    if (signed) return signed;

    const publicPath = this.storage.getPublicPath(gcsKey);
    if (!publicPath) return null;
    if (publicPath.startsWith('http')) return publicPath;

    const publicApi =
      this.config.get<string>('PUBLIC_API_URL')?.trim() ||
      this.config.get<string>('CORS_ORIGIN')?.trim() ||
      '';
    if (publicApi) {
      const base = publicApi.replace(/\/$/, '');
      // CORS_ORIGIN is site origin; uploads are under /api
      if (publicPath.startsWith('/api')) {
        return `${base}${publicPath}`;
      }
      return `${base}${publicPath}`;
    }

    const port = this.config.get<string>('PORT') ?? '3000';
    return `http://127.0.0.1:${port}${publicPath}`;
  }

  private assertImage(file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        'Unsupported image type. Use JPEG, PNG, WebP, or SVG.',
      );
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('Image must be 2MB or smaller');
    }
  }

  private async toView(template: {
    id: string;
    tenantId: string;
    logoGcsKey: string | null;
    letterhead: string | null;
    headerHtml: string;
    footerHtml: string;
    primaryColor: string;
    invoiceTitle: string;
    showGstin: boolean;
    logoWidthPx: number;
    bannerHeightPx: number;
    invoiceTheme: string;
    logoAlign: string;
    headerMode: string;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<BrandingView> {
    const [logoUrl, bannerUrl] = await Promise.all([
      this.resolveMediaUrl(template.logoGcsKey),
      this.resolveMediaUrl(template.letterhead),
    ]);
    return {
      ...template,
      logoUrl,
      bannerUrl,
    };
  }
}
