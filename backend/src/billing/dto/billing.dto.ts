import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  BillingCycle,
  SubscriptionStatus,
  SubPaymentMethod,
} from '@prisma/client';

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(0)
  priceMonthlyInr!: number;

  @IsInt()
  @Min(0)
  priceYearlyInr!: number;

  @IsInt()
  @Min(1)
  maxUsers!: number;

  @IsInt()
  @Min(1)
  maxInvoices!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @IsOptional()
  @IsArray()
  features?: string[];

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isCustom?: boolean;
}

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceMonthlyInr?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceYearlyInr?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxInvoices?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @IsOptional()
  @IsArray()
  features?: string[];

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isCustom?: boolean;
}

export class AssignSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  planId!: string;

  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsString()
  startsAt?: string;

  @IsOptional()
  @IsString()
  endsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  amountInr?: number;

  @IsOptional()
  @IsEnum(SubPaymentMethod)
  paymentMethod?: SubPaymentMethod;

  @IsOptional()
  @IsString()
  paymentRef?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsString()
  endsAt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  extendDays?: number;

  @IsOptional()
  @IsString()
  paymentRef?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @IsOptional()
  @IsInt()
  @Min(0)
  amountInr?: number;
}

export class UpdatePaymentSettingsDto {
  @IsOptional()
  @IsBoolean()
  gatewayEnabled?: boolean;

  @IsOptional()
  @IsString()
  razorpayKeyId?: string | null;

  /** Plain secret; omit to leave; empty string clears */
  @IsOptional()
  @IsString()
  razorpayKeySecret?: string | null;

  @IsOptional()
  @IsString()
  razorpayWebhookSecret?: string | null;

  @IsOptional()
  @IsString()
  manualUpiId?: string | null;

  @IsOptional()
  @IsString()
  manualBankDetails?: string | null;
}

export class CheckoutDto {
  @IsString()
  @IsNotEmpty()
  planId!: string;

  @IsEnum(BillingCycle)
  billingCycle!: BillingCycle;
}

export class VerifyCheckoutDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsString()
  @IsNotEmpty()
  paymentId!: string;

  @IsString()
  @IsNotEmpty()
  signature!: string;
}
