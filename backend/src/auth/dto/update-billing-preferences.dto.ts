import { IsEnum, IsOptional, ValidateIf } from 'class-validator';
import { InvoiceTheme, PrintFormat } from '@prisma/client';

export class UpdateBillingPreferencesDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsEnum(PrintFormat)
  preferredPrintFormat?: PrintFormat | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsEnum(InvoiceTheme)
  preferredInvoiceTheme?: InvoiceTheme | null;
}
