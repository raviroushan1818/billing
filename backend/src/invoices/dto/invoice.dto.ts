import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  DocumentType,
  PaymentMode,
  SupplyType,
} from '@prisma/client';

export class InvoiceLineDto {
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsString()
  hsnSac?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsInt()
  @Min(1)
  qty!: number;

  @IsNumber()
  @Min(0)
  rate!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  gstRate?: number;

  @IsOptional()
  @IsUUID()
  godownId?: string;
}

export class InvoicePaymentDto {
  @IsEnum(PaymentMode)
  mode!: PaymentMode;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  upiRefId?: string;

  @IsOptional()
  @IsString()
  cardLast4?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateInvoiceDto {
  @IsOptional()
  @IsUUID()
  partyId?: string;

  @IsString()
  @IsNotEmpty()
  partyName!: string;

  @IsOptional()
  @IsString()
  partyPhone?: string;

  @IsOptional()
  @IsString()
  partyAddress?: string;

  @IsOptional()
  @IsString()
  partyGstin?: string;

  @IsOptional()
  @IsString()
  partyStateCode?: string;

  @IsOptional()
  @IsString()
  partyExternalId?: string;

  @IsOptional()
  @IsString()
  referredBy?: string;

  @IsOptional()
  @IsString()
  placeOfSupply?: string;

  @IsOptional()
  @IsEnum(SupplyType)
  supplyType?: SupplyType;

  @IsOptional()
  @IsBoolean()
  reverseCharge?: boolean;

  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  discountAmount?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines!: InvoiceLineDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoicePaymentDto)
  payments?: InvoicePaymentDto[];

  @IsOptional()
  @IsBoolean()
  finalize?: boolean;
}

/** Same shape as create — used to replace a DRAFT invoice. */
export class UpdateDraftInvoiceDto extends CreateInvoiceDto {}

export class CreateNoteDto extends CreateInvoiceDto {
  @IsUUID()
  referenceInvoiceId!: string;

  @IsOptional()
  @IsIn([DocumentType.CREDIT_NOTE, DocumentType.DEBIT_NOTE])
  documentType?: DocumentType;
}

export class VoidInvoiceDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class AddPaymentDto {
  @IsEnum(PaymentMode)
  mode!: PaymentMode;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  upiRefId?: string;

  @IsOptional()
  @IsString()
  cardLast4?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListInvoicesQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  partyId?: string;

  @IsOptional()
  @IsString()
  fy?: string;
}

export class ShareEmailDto {
  @IsEmail()
  @IsNotEmpty()
  to!: string;

  @IsOptional()
  @IsString()
  message?: string;
}

export class ShareWhatsappDto {
  @IsString()
  @IsNotEmpty()
  toE164!: string;

  @IsOptional()
  @IsString()
  message?: string;
}
