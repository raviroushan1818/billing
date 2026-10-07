import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BusinessProfile, TenantStatus } from '@prisma/client';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsEnum(BusinessProfile)
  profileType!: BusinessProfile;

  @IsOptional()
  @IsString()
  planCode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxInvoices?: number;

  /** Optional explicit Client ID; otherwise generated from platform format settings */
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, {
    message:
      'Client ID must start with a letter/number and use only letters, numbers, _ or -',
  })
  clientId?: string;

  /** Optional first CLIENT_ADMIN created with the tenant */
  @IsOptional()
  @IsEmail()
  adminEmail?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  adminPassword?: string;

  @IsOptional()
  @IsString()
  adminFirstName?: string;

  @IsOptional()
  @IsString()
  adminLastName?: string;

  @IsOptional()
  @IsString()
  adminPhone?: string;
}

export class UpdateTenantStatusDto {
  @IsEnum(TenantStatus)
  status!: TenantStatus;
}

export class UpdateTenantClientIdDto {
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, {
    message:
      'Client ID must start with a letter/number and use only letters, numbers, _ or -',
  })
  clientId!: string;
}

export class UpdatePlatformSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(12)
  @Matches(/^[A-Za-z0-9]+$/, {
    message: 'Prefix must be letters/numbers only',
  })
  clientIdPrefix?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  @Matches(/^[-_]?$/, {
    message: 'Separator must be empty, hyphen, or underscore',
  })
  clientIdSeparator?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(16)
  clientIdSuffixLength?: number;
}

export class CreateTenantAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
