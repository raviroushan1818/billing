import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseLineDto {
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

  @IsNumber()
  @Min(0.001)
  qty!: number;

  @IsNumber()
  @Min(0)
  rate!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  gstRate?: number;
}

export class CreatePurchaseDto {
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @IsString()
  @IsNotEmpty()
  vendorName!: string;

  @IsOptional()
  @IsString()
  vendorGstin?: string;

  @IsOptional()
  @IsString()
  vendorPhone?: string;

  @IsOptional()
  @IsUUID()
  godownId?: string;

  @IsOptional()
  @IsDateString()
  billDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  interstate?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineDto)
  lines!: PurchaseLineDto[];
}
