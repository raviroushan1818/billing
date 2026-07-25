export type UserRole =
  | 'SUPER_ADMIN'
  | 'CLIENT_ADMIN'
  | 'BILLING_OPERATOR'
  | 'ACCOUNTANT'
  | 'VIEWER';

export type BusinessProfile =
  | 'HOSPITAL'
  | 'SCHOOL'
  | 'COMMERCIAL'
  | 'CLINIC'
  | 'RETAIL'
  | 'GENERIC';

export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'TRIAL';

export type InvoiceStatus = 'DRAFT' | 'FINALIZED' | 'VOID';

export type PaymentMode = 'CASH' | 'UPI' | 'CARD';

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string;
  clientId?: string;
  tenantName?: string;
  profileType?: BusinessProfile;
  tenant?: {
    id: string;
    clientId: string;
    name: string;
    profileType?: BusinessProfile;
  };
};

export type Tenant = {
  id: string;
  clientId: string;
  name: string;
  legalName?: string | null;
  profileType: BusinessProfile;
  status: TenantStatus;
  planCode?: string;
  maxUsers?: number;
  maxInvoices?: number;
  createdAt?: string;
};

export type TenantMe = Tenant & {
  profileConfig?: {
    partyLabel: string;
    partyIdLabel: string;
    invoiceTitle: string;
    customFieldSchema?: Record<string, unknown>;
  };
};

export type Party = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  stateCode?: string | null;
  pincode?: string | null;
  gstin?: string | null;
  externalId?: string | null;
  referredBy?: string | null;
  customFields?: Record<string, unknown>;
  isActive?: boolean;
};

export type Item = {
  id: string;
  name: string;
  description?: string | null;
  hsnSac?: string | null;
  unit?: string;
  rate: number | string;
  gstRate: number | string;
  barcode?: string | null;
  trackStock?: boolean;
  stockQty?: number | string;
  isActive?: boolean;
};

export type GstSettings = {
  id?: string;
  gstin?: string | null;
  legalName: string;
  tradeName?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  email?: string | null;
  phone?: string | null;
  fyStartMonth?: number;
  defaultGstRate?: number | string;
  eInvoiceEnabled?: boolean;
  eInvoiceThreshold?: number | string;
};

export type Branding = {
  id?: string;
  headerHtml?: string;
  footerHtml?: string;
  letterhead?: string | null;
  primaryColor?: string;
  invoiceTitle?: string;
  showGstin?: boolean;
  logoGcsKey?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  logoWidthPx?: number;
  bannerHeightPx?: number;
  invoiceTheme?: 'CLASSIC' | 'MODERN' | 'COMPACT' | 'BOLD';
  logoAlign?: 'LEFT' | 'CENTER' | 'RIGHT';
  headerMode?: 'COMPOSED' | 'LETTERHEAD';
};

export type IntegrationSettings = {
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpUser?: string | null;
  smtpSecure?: boolean;
  smtpFromEmail?: string | null;
  smtpFromName?: string | null;
  hasSmtpPass?: boolean;
  waPhoneNumberId?: string | null;
  waApiVersion?: string | null;
  hasWaToken?: boolean;
};

export type ImportSummary = {
  created: number;
  updated: number;
  errors: Array<{ row: number; message: string }>;
};

export type InvoiceLine = {
  id?: string;
  lineNo?: number;
  itemId?: string | null;
  godownId?: string | null;
  godown?: { id: string; name: string; code?: string | null } | null;
  description: string;
  hsnSac?: string | null;
  unit?: string;
  qty: number | string;
  rate: number | string;
  discount?: number | string;
  gstRate: number | string;
  taxableValue?: number | string;
  lineTotal?: number | string;
};

export type InvoicePayment = {
  id?: string;
  mode: PaymentMode;
  amount: number | string;
  upiRefId?: string | null;
  cardLast4?: string | null;
  notes?: string | null;
};

export type InvoiceActor = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
};

export type Invoice = {
  id: string;
  billNo: string;
  documentType?: 'TAX_INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
  status: InvoiceStatus;
  invoiceDate: string;
  partyId?: string | null;
  partyName: string;
  partyPhone?: string | null;
  partyAddress?: string | null;
  partyGstin?: string | null;
  partyExternalId?: string | null;
  referredBy?: string | null;
  referenceInvoiceId?: string | null;
  taxableAmount?: number | string;
  cgstAmount?: number | string;
  sgstAmount?: number | string;
  igstAmount?: number | string;
  discountAmount?: number | string;
  grandTotal: number | string;
  roundOff?: number | string;
  amountPaid?: number | string;
  balanceDue?: number | string;
  paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID';
  dueDate?: string | null;
  lines?: InvoiceLine[];
  payments?: InvoicePayment[];
  createdAt?: string;
  deletedAt?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  createdById?: string | null;
  voidedById?: string | null;
  createdBy?: InvoiceActor | null;
  voidedBy?: InvoiceActor | null;
};

export type TenantUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string | null;
  isActive?: boolean;
  lastLoginAt?: string | null;
};

export type PlatformInquiry = {
  id: string;
  name: string;
  businessName: string;
  phone: string;
  email: string;
  message: string;
  status: 'NEW' | 'READ';
  createdAt: string;
  updatedAt?: string;
};

export type DayBookEntry = {
  date: string;
  billNo: string;
  partyName: string;
  documentType?: string;
  status: InvoiceStatus;
  taxableAmount: number | string;
  cgstAmount: number | string;
  sgstAmount: number | string;
  igstAmount: number | string;
  grandTotal: number | string;
  payments?: Array<{ mode: PaymentMode | string; amount: number | string }>;
};

export type DayBookReport = {
  from: string;
  to: string;
  entries: DayBookEntry[];
  totals: {
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    grand: number;
    invoiceCount: number;
  };
};

export type CollectionsReport = {
  from?: string;
  to?: string;
  cash: number | string;
  upi: number | string;
  card: number | string;
  total: number | string;
  paymentCount?: number;
  byMode?: Record<string, number>;
};

export type CreateTenantPayload = {
  name: string;
  profileType: BusinessProfile;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
};

export type CreateInvoicePayload = {
  invoiceDate?: string;
  dueDate?: string;
  partyId?: string;
  partyName: string;
  partyPhone?: string;
  partyAddress?: string;
  partyGstin?: string;
  partyExternalId?: string;
  referredBy?: string;
  referenceInvoiceId?: string;
  notes?: string;
  lines: Array<{
    itemId?: string;
    description: string;
    hsnSac?: string;
    qty: number;
    rate: number;
    discount?: number;
    gstRate: number;
    godownId?: string;
  }>;
  payments?: Array<{
    mode: PaymentMode;
    amount: number;
    upiRefId?: string;
    cardLast4?: string;
  }>;
  finalize?: boolean;
};

export type SubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  description?: string;
  priceMonthlyInr: number;
  priceYearlyInr: number;
  maxUsers: number;
  maxInvoices: number;
  trialDays?: number;
  features?: string[] | unknown;
  isPublic?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  isCustom?: boolean;
};

export type TenantSubscription = {
  id: string;
  tenantId: string;
  planId: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
  startsAt: string;
  endsAt: string;
  amountInr: number;
  paymentMethod?: 'MANUAL' | 'RAZORPAY';
  paymentRef?: string | null;
  notes?: string | null;
  plan?: SubscriptionPlan;
  tenant?: { id: string; clientId: string; name: string; status: TenantStatus };
};

export type PaymentSettings = {
  id: string;
  gatewayEnabled: boolean;
  razorpayKeyId?: string | null;
  hasKeySecret: boolean;
  hasWebhookSecret: boolean;
  manualUpiId?: string | null;
  manualBankDetails?: string | null;
};

export type BillingAnalytics = {
  activePaid: number;
  trials: number;
  expiringIn7Days: number;
  mrrInr: number;
  arrInr: number;
  planMix: Array<{ planId: string; code: string; count: number; revenueInr: number }>;
  paidOrderCount: number;
  paidVolumeInr: number;
};

export type WorkspaceNote = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  remindAt?: string | null;
  partyId?: string | null;
  invoiceId?: string | null;
  party?: { id: string; name: string } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Godown = {
  id: string;
  name: string;
  code?: string | null;
  address?: string | null;
  isDefault: boolean;
  isActive: boolean;
};

export type GodownStockRow = {
  id: string;
  qty: number | string;
  item: { id: string; name: string; unit: string; barcode?: string | null };
  godown: { id: string; name: string; code?: string | null };
};

export type PurchaseBill = {
  id: string;
  billNo: string;
  status: 'DRAFT' | 'FINALIZED' | 'VOID';
  billDate: string;
  vendorName: string;
  vendorGstin?: string | null;
  vendorPhone?: string | null;
  godownId?: string | null;
  godown?: { id: string; name: string } | null;
  taxableAmount: number | string;
  cgstAmount: number | string;
  sgstAmount: number | string;
  igstAmount: number | string;
  grandTotal: number | string;
  notes?: string | null;
  itcEligible?: boolean;
  itcCgst?: number | string;
  itcSgst?: number | string;
  itcIgst?: number | string;
  itcNotes?: string | null;
  lines?: Array<{
    id: string;
    description: string;
    qty: number | string;
    rate: number | string;
    gstRate: number | string;
    lineTotal: number | string;
    itemId?: string | null;
  }>;
};

export type EwayBill = {
  id: string;
  status: 'DRAFT' | 'GENERATED' | 'CANCELLED' | 'FAILED';
  ewbNo?: string | null;
  vehicleNo?: string | null;
  transporter?: string | null;
  fromPlace?: string | null;
  toPlace?: string | null;
  distanceKm?: number | null;
  validUntil?: string | null;
  cancelReason?: string | null;
  invoiceId: string;
  invoice?: {
    id: string;
    billNo: string;
    partyName: string;
    grandTotal: number | string;
    invoiceDate?: string;
  };
  createdAt?: string;
};


