import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpsertIntegrationsDto {
  @IsOptional()
  @IsString()
  smtpHost?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort?: number | null;

  @IsOptional()
  @IsString()
  smtpUser?: string | null;

  /** Plain SMTP password; encrypted at rest. Omit or null to leave unchanged; empty string clears. */
  @IsOptional()
  @IsString()
  smtpPass?: string | null;

  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  @IsOptional()
  @IsEmail()
  smtpFromEmail?: string | null;

  @IsOptional()
  @IsString()
  smtpFromName?: string | null;

  @IsOptional()
  @IsString()
  waPhoneNumberId?: string | null;

  /** Plain WhatsApp access token; encrypted at rest. Omit or null to leave unchanged; empty string clears. */
  @IsOptional()
  @IsString()
  waAccessToken?: string | null;

  @IsOptional()
  @IsString()
  waApiVersion?: string;
}

export class TestEmailDto {
  @IsEmail()
  @IsNotEmpty()
  to!: string;
}
