import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateEwayDto {
  @IsUUID()
  invoiceId!: string;

  @IsOptional()
  @IsString()
  fromPlace?: string;

  @IsOptional()
  @IsString()
  toPlace?: string;

  @IsOptional()
  @IsString()
  transporterName?: string;

  @IsOptional()
  @IsString()
  transporterId?: string;

  @IsOptional()
  @IsString()
  vehicleNo?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  distanceKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  documentValue?: number;
}

export class CancelEwayDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
