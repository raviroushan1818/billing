import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpsertGstSettingsDto {
  @IsOptional()
  @IsString()
  gstin?: string;

  @IsString()
  @IsNotEmpty()
  legalName!: string;

  @IsOptional()
  @IsString()
  tradeName?: string;

  @IsString()
  @IsNotEmpty()
  addressLine1!: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;

  @IsString()
  @IsNotEmpty()
  stateCode!: string;

  @IsString()
  @IsNotEmpty()
  pincode!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  fyStartMonth?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultGstRate?: number;

  @IsOptional()
  @IsBoolean()
  eInvoiceEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  eInvoiceThreshold?: number;
}
