import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BrandAlign, HeaderMode, InvoiceTheme } from '@prisma/client';

export class UpdateBrandTemplateDto {
  @IsOptional()
  @IsString()
  logoGcsKey?: string;

  @IsOptional()
  @IsString()
  headerHtml?: string;

  @IsOptional()
  @IsString()
  footerHtml?: string;

  @IsOptional()
  @IsString()
  letterhead?: string;

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  invoiceTitle?: string;

  @IsOptional()
  @IsBoolean()
  showGstin?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(40)
  @Max(200)
  logoWidthPx?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(40)
  @Max(240)
  bannerHeightPx?: number;

  @IsOptional()
  @IsEnum(InvoiceTheme)
  invoiceTheme?: InvoiceTheme;

  @IsOptional()
  @IsEnum(BrandAlign)
  logoAlign?: BrandAlign;

  @IsOptional()
  @IsEnum(HeaderMode)
  headerMode?: HeaderMode;
}
