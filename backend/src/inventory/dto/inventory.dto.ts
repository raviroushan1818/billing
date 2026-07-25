import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateGodownDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateGodownDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string | null;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TransferStockDto {
  @IsUUID()
  itemId!: string;

  @IsUUID()
  fromGodownId!: string;

  @IsUUID()
  toGodownId!: string;

  @IsNumber()
  qty!: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class AdjustGodownStockDto {
  @IsNumber()
  qtyDelta!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
