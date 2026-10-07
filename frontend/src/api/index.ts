import {
  api,
  ApiError,
  clearAuth,
  downloadJson,
  getStoredToken,
  storeAuth,
} from './client';
import { todayIso } from '../utils/format';
import type {
  AuthUser,
  BillingAnalytics,
  Branding,
  CollectionsReport,
  CreateInvoicePayload,
  CreateTenantPayload,
  DayBookReport,
  EwayBill,
  Godown,
  GodownStockRow,
  GstSettings,
  ImportSummary,
  IntegrationSettings,
  Invoice,
  InvoiceTheme,
  Item,
  Party,
  PaymentMode,
  PaymentSettings,
  PlatformInquiry,
  PlatformSettings,
  PrintFormat,
  PurchaseBill,
  SubscriptionPlan,
  Tenant,
  TenantMe,
  TenantSubscription,
  TenantUser,
  WorkspaceNote,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

export const authApi = {
  login(clientId: string, email: string, password: string) {
    return api<{ accessToken: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ clientId, email, password }),
    }).then((res) => {
      storeAuth(res.accessToken, res.user);
      return res;
    });
  },
  me() {
    return api<AuthUser>('/auth/me');
  },
  changePassword(currentPassword: string, newPassword: string) {
    return api<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
  updatePreferences(payload: {
    preferredPrintFormat?: PrintFormat | null;
    preferredInvoiceTheme?: InvoiceTheme | null;
  }) {
    return api<AuthUser>('/auth/preferences', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  logout() {
    clearAuth();
  },
};

export const platformApi = {
  getSettings() {
    return api<PlatformSettings>('/platform/settings');
  },
  updateSettings(payload: {
    clientIdPrefix?: string;
    clientIdSeparator?: string;
    clientIdSuffixLength?: number;
  }) {
    return api<PlatformSettings>('/platform/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  listTenants() {
    return api<Tenant[]>('/platform/tenants');
  },
  createTenant(payload: CreateTenantPayload) {
    return api<Tenant & { adminUser?: TenantUser }>('/platform/tenants', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  updateTenantClientId(id: string, clientId: string) {
    return api<Tenant>(`/platform/tenants/${id}/client-id`, {
      method: 'PATCH',
      body: JSON.stringify({ clientId }),
    });
  },
  updateTenantStatus(id: string, status: string) {
    return api<Tenant>(`/platform/tenants/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
  listInquiries(status?: string) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return api<PlatformInquiry[]>(`/platform/inquiries${qs}`);
  },
  updateInquiryStatus(id: string, status: 'NEW' | 'READ') {
    return api<PlatformInquiry>(`/platform/inquiries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
  listPlans() {
    return api<SubscriptionPlan[]>('/platform/plans');
  },
  createPlan(payload: Partial<SubscriptionPlan> & { code: string; name: string }) {
    return api<SubscriptionPlan>('/platform/plans', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  updatePlan(id: string, payload: Partial<SubscriptionPlan>) {
    return api<SubscriptionPlan>(`/platform/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  deactivatePlan(id: string) {
    return api<SubscriptionPlan>(`/platform/plans/${id}`, { method: 'DELETE' });
  },
  listSubscriptions(params?: {
    status?: string;
    planId?: string;
    expiringDays?: number;
  }) {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.planId) qs.set('planId', params.planId);
    if (params?.expiringDays != null)
      qs.set('expiringDays', String(params.expiringDays));
    const q = qs.toString();
    return api<TenantSubscription[]>(
      `/platform/subscriptions${q ? `?${q}` : ''}`,
    );
  },
  assignSubscription(
    tenantId: string,
    payload: {
      planId: string;
      billingCycle?: 'MONTHLY' | 'YEARLY';
      status?: string;
      amountInr?: number;
      paymentRef?: string;
      notes?: string;
      endsAt?: string;
    },
  ) {
    return api<TenantSubscription>(
      `/platform/tenants/${tenantId}/subscription`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },
  updateSubscription(
    id: string,
    payload: {
      status?: string;
      extendDays?: number;
      endsAt?: string;
      paymentRef?: string;
      notes?: string;
      planId?: string;
      amountInr?: number;
    },
  ) {
    return api<TenantSubscription>(`/platform/subscriptions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  getPaymentSettings() {
    return api<PaymentSettings>('/platform/payment-settings');
  },
  updatePaymentSettings(payload: {
    gatewayEnabled?: boolean;
    razorpayKeyId?: string | null;
    razorpayKeySecret?: string | null;
    razorpayWebhookSecret?: string | null;
    manualUpiId?: string | null;
    manualBankDetails?: string | null;
  }) {
    return api<PaymentSettings>('/platform/payment-settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  billingAnalytics() {
    return api<BillingAnalytics>('/platform/analytics/billing');
  },
};

export const publicApi = {
  createInquiry(payload: {
    name: string;
    businessName: string;
    phone: string;
    email: string;
    message: string;
  }) {
    return api<{ ok: boolean; id: string; message: string }>(
      '/public/inquiries',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },
  listPlans() {
    return api<SubscriptionPlan[]>('/public/plans');
  },
  paymentMode() {
    return api<{
      mode: 'razorpay' | 'manual';
      keyId?: string;
      manualUpiId?: string | null;
      manualBankDetails?: string | null;
    }>('/public/payment-mode');
  },
};

export const billingApi = {
  subscription() {
    return api<{
      subscription: TenantSubscription | null;
      tenant: {
        planCode: string;
        maxUsers: number;
        maxInvoices: number;
        status: string;
      };
      usage: { invoices: number; users: number };
      paymentMode: {
        mode: 'razorpay' | 'manual';
        keyId?: string;
        manualUpiId?: string | null;
        manualBankDetails?: string | null;
      };
    }>('/billing/subscription');
  },
  checkout(payload: { planId: string; billingCycle: 'MONTHLY' | 'YEARLY' }) {
    return api<{
      mode: 'razorpay' | 'manual';
      orderId: string;
      razorpayOrderId?: string;
      amountInr: number;
      amountPaise?: number;
      currency?: string;
      keyId?: string;
      plan: SubscriptionPlan;
      billingCycle: string;
      instructions?: {
        upiId?: string | null;
        bankDetails?: string | null;
        message: string;
      };
    }>('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  verify(payload: {
    orderId: string;
    paymentId: string;
    signature: string;
  }) {
    return api('/billing/checkout/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  features() {
    return api<Record<string, boolean>>('/billing/features');
  },
};

export const notesApi = {
  list(partyId?: string) {
    const qs = partyId ? `?partyId=${encodeURIComponent(partyId)}` : '';
    return api<WorkspaceNote[]>(`/notes${qs}`);
  },
  create(payload: {
    title: string;
    body?: string;
    partyId?: string;
    pinned?: boolean;
    remindAt?: string;
  }) {
    return api<WorkspaceNote>('/notes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  update(
    id: string,
    payload: Partial<{
      title: string;
      body: string;
      partyId: string | null;
      pinned: boolean;
      remindAt: string | null;
    }>,
  ) {
    return api<WorkspaceNote>(`/notes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  remove(id: string) {
    return api<{ ok: boolean }>(`/notes/${id}`, { method: 'DELETE' });
  },
};

export const tenantApi = {
  me() {
    return api<TenantMe>('/tenants/me');
  },
  listUsers() {
    return api<TenantUser[]>('/tenants/users');
  },
  createUser(payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: string;
    phone?: string;
  }) {
    return api<TenantUser>('/tenants/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  updateUser(
    id: string,
    payload: {
      role?: string;
      isActive?: boolean;
      firstName?: string;
      lastName?: string;
      phone?: string | null;
    },
  ) {
    return api<TenantUser>(`/tenants/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};

export const gstApi = {
  getSettings() {
    return api<GstSettings>('/gst/settings');
  },
  updateSettings(payload: Partial<GstSettings>) {
    return api<GstSettings>('/gst/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
};

export const partiesApi = {
  list() {
    return api<Party[]>('/parties');
  },
  search(q: string) {
    return api<Party[]>(`/parties/search?q=${encodeURIComponent(q)}`);
  },
  create(payload: Partial<Party>) {
    return api<Party>('/parties', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  update(id: string, payload: Partial<Party>) {
    return api<Party>(`/parties/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  importCsv(file: File) {
    return uploadCsv<ImportSummary>('/parties/import', file);
  },
};

export const itemsApi = {
  list() {
    return api<Item[]>('/items');
  },
  search(q: string) {
    return api<Item[]>(`/items/search?q=${encodeURIComponent(q)}`);
  },
  create(payload: Partial<Item>) {
    return api<Item>('/items', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  update(id: string, payload: Partial<Item>) {
    return api<Item>(`/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  adjustStock(id: string, payload: { qtyDelta: number; note?: string }) {
    return api<Item>(`/items/${id}/stock`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  importCsv(file: File) {
    return uploadCsv<ImportSummary>('/items/import', file);
  },
};

export const invoicesApi = {
  list(params?: {
    from?: string;
    to?: string;
    status?: string;
    paymentStatus?: string;
    documentType?: string;
    partyId?: string;
    q?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    if (params?.status) qs.set('status', params.status);
    if (params?.paymentStatus) qs.set('paymentStatus', params.paymentStatus);
    if (params?.documentType) qs.set('documentType', params.documentType);
    if (params?.partyId) qs.set('partyId', params.partyId);
    if (params?.q) qs.set('q', params.q);
    const query = qs.toString();
    return api<Invoice[]>(`/invoices${query ? `?${query}` : ''}`);
  },
  get(id: string) {
    return api<Invoice>(`/invoices/${id}`);
  },
  create(payload: CreateInvoicePayload) {
    return api<Invoice>('/invoices', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  updateDraft(id: string, payload: CreateInvoicePayload) {
    return api<Invoice>(`/invoices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  createCreditNote(payload: CreateInvoicePayload) {
    return api<Invoice>('/invoices/credit-notes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  createDebitNote(payload: CreateInvoicePayload) {
    return api<Invoice>('/invoices/debit-notes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  addPayment(
    id: string,
    payload: {
      mode: PaymentMode;
      amount: number;
      upiRefId?: string;
      cardLast4?: string;
      notes?: string;
    },
  ) {
    return api<Invoice>(`/invoices/${id}/payments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  finalize(id: string) {
    return api<Invoice>(`/invoices/${id}/finalize`, { method: 'POST' });
  },
  void(id: string, reason?: string) {
    return api<Invoice>(`/invoices/${id}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
  print(id: string, format?: 'A4' | 'THERMAL_80' | 'THERMAL_58') {
    const q = format ? `?format=${encodeURIComponent(format)}` : '';
    return api<{
      html?: string;
      url?: string;
      publicPath?: string;
      signedUrl?: string;
      gcsKey?: string;
      printFormat?: string;
    }>(`/invoices/${id}/print${q}`, {
      method: 'POST',
    });
  },
  shareEmail(id: string, payload: { to: string; message?: string }) {
    return api<{ ok: boolean }>(`/invoices/${id}/share/email`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  shareWhatsapp(id: string, payload: { toE164: string; message?: string }) {
    return api<{ ok: boolean }>(`/invoices/${id}/share/whatsapp`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  softDelete(id: string) {
    return api<{ ok: boolean }>(`/invoices/${id}`, { method: 'DELETE' });
  },
  recycleBin() {
    return api<Invoice[]>('/invoices/recycle-bin');
  },
  restore(id: string) {
    return api<Invoice>(`/invoices/${id}/restore`, { method: 'POST' });
  },
  permanentDelete(id: string) {
    return api<{ ok: boolean }>(`/invoices/${id}/permanent`, {
      method: 'DELETE',
    });
  },
  emptyRecycleBin() {
    return api<{ ok: boolean; count: number }>('/invoices/recycle-bin/empty', {
      method: 'POST',
    });
  },
};

export const brandingApi = {
  get() {
    return api<Branding>('/branding');
  },
  update(payload: Partial<Branding>) {
    return api<Branding>('/branding', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  uploadLogo(file: File) {
    return uploadBrandingFile('/branding/logo', file);
  },
  uploadBanner(file: File) {
    return uploadBrandingFile('/branding/banner', file);
  },
  removeLogo() {
    return api<Branding>('/branding/logo', { method: 'DELETE' });
  },
  removeBanner() {
    return api<Branding>('/branding/banner', { method: 'DELETE' });
  },
};

async function uploadBrandingFile(path: string, file: File): Promise<Branding> {
  const token = getStoredToken();
  const body = new FormData();
  body.append('file', file);
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body,
  });
  if (res.status === 401) {
    clearAuth();
    window.dispatchEvent(new Event('billing:unauthorized'));
  }
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = Array.isArray(data.message)
        ? data.message.join(', ')
        : (data.message ?? message);
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<Branding>;
}

async function uploadCsv<T>(path: string, file: File): Promise<T> {
  const token = getStoredToken();
  const body = new FormData();
  body.append('file', file);
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body,
  });
  if (res.status === 401) {
    clearAuth();
    window.dispatchEvent(new Event('billing:unauthorized'));
  }
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = Array.isArray(data.message)
        ? data.message.join(', ')
        : (data.message ?? message);
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

export const integrationsApi = {
  get() {
    return api<IntegrationSettings>('/integrations');
  },
  update(payload: Record<string, unknown>) {
    return api<IntegrationSettings>('/integrations', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
  testEmail(to: string) {
    return api<{ ok: boolean }>('/integrations/test-email', {
      method: 'POST',
      body: JSON.stringify({ to }),
    });
  },
};

export const hmsApi = {
  status() {
    return api<{
      linked: boolean;
      clientId?: string;
      apiKeyPrefix?: string | null;
      hmsBaseUrl?: string | null;
      hasWebhookSecret?: boolean;
    }>('/hms/status');
  },
  issueApiKey(hmsBaseUrl?: string) {
    return api<{
      clientId: string;
      apiKey: string;
      webhookSecret: string;
      message: string;
    }>('/hms/api-key', {
      method: 'POST',
      body: JSON.stringify({ hmsBaseUrl }),
    });
  },
};

export const reportsApi = {
  dayBook(from?: string, to?: string) {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    const query = qs.toString();
    return api<DayBookReport>(`/reports/day-book${query ? `?${query}` : ''}`);
  },
  collections(from?: string, to?: string) {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    const query = qs.toString();
    return api<CollectionsReport>(
      `/reports/collections${query ? `?${query}` : ''}`,
    );
  },
  async gstr1(from?: string, to?: string) {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    const query = qs.toString();
    const data = await api<unknown>(`/reports/gstr1${query ? `?${query}` : ''}`);
    downloadJson(`gstr1-${from ?? 'export'}-to-${to ?? 'export'}.json`, data);
    return data;
  },
  receivables() {
    return api<{
      rows: Array<{
        id: string;
        billNo: string;
        partyName: string;
        balanceDue: number;
        amountPaid: number;
        grandTotal: number;
        dueDate: string;
        daysPastDue: number;
        bucket: string;
        paymentStatus: string;
      }>;
      summary: {
        totalDue: number;
        count: number;
        byBucket: Record<string, number>;
      };
    }>('/reports/receivables');
  },
  itc(from?: string, to?: string) {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    const query = qs.toString();
    return api<{
      rows: Array<{
        id: string;
        billNo: string;
        billDate: string;
        vendorName: string;
        vendorGstin?: string | null;
        taxableAmount: number;
        itcEligible: boolean;
        itcCgst: number;
        itcSgst: number;
        itcIgst: number;
        itcTotal: number;
        itcNotes?: string | null;
        grandTotal: number;
      }>;
      summary: {
        purchaseCount: number;
        eligibleCount: number;
        taxable: number;
        itcCgst: number;
        itcSgst: number;
        itcIgst: number;
        itcTotal: number;
      };
    }>(`/reports/itc${query ? `?${query}` : ''}`);
  },
};

export const auditApi = {
  list(take = 100) {
    return api<
      Array<{
        id: string;
        action: string;
        entityType?: string | null;
        entityId?: string | null;
        createdAt: string;
        user?: {
          email: string;
          firstName: string;
          lastName: string;
        } | null;
        meta?: unknown;
      }>
    >(`/audit?take=${take}`);
  },
};

export const dashboardApi = {
  async todaySummary() {
    const today = todayIso();
    const [invoices, collections] = await Promise.all([
      invoicesApi.list({ from: today, to: today, status: 'FINALIZED' }),
      reportsApi.collections(today, today),
    ]);
    return { invoices, collections, today };
  },
};

export const inventoryApi = {
  listGodowns() {
    return api<Godown[]>('/godowns');
  },
  createGodown(payload: {
    name: string;
    code?: string;
    address?: string;
    isDefault?: boolean;
  }) {
    return api<Godown>('/godowns', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  updateGodown(
    id: string,
    payload: Partial<{
      name: string;
      code: string | null;
      address: string | null;
      isDefault: boolean;
      isActive: boolean;
    }>,
  ) {
    return api<Godown>(`/godowns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  stock(godownId?: string) {
    const qs = godownId ? `?godownId=${encodeURIComponent(godownId)}` : '';
    return api<GodownStockRow[]>(`/inventory/stock${qs}`);
  },
  transfer(payload: {
    itemId: string;
    fromGodownId: string;
    toGodownId: string;
    qty: number;
    note?: string;
  }) {
    return api<{ ok: boolean }>('/inventory/transfer', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

export const purchasesApi = {
  list() {
    return api<PurchaseBill[]>('/purchases');
  },
  get(id: string) {
    return api<PurchaseBill>(`/purchases/${id}`);
  },
  create(payload: {
    vendorId?: string;
    vendorName: string;
    vendorGstin?: string;
    vendorPhone?: string;
    godownId?: string;
    billDate?: string;
    notes?: string;
    interstate?: boolean;
    lines: Array<{
      itemId?: string;
      description: string;
      hsnSac?: string;
      unit?: string;
      qty: number;
      rate: number;
      gstRate?: number;
    }>;
  }) {
    return api<PurchaseBill>('/purchases', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  void(id: string) {
    return api<PurchaseBill>(`/purchases/${id}/void`, { method: 'POST' });
  },
};

export const ewayApi = {
  list() {
    return api<EwayBill[]>('/eway');
  },
  create(payload: {
    invoiceId: string;
    fromPlace?: string;
    toPlace?: string;
    transporterName?: string;
    vehicleNo?: string;
    distanceKm?: number;
  }) {
    return api<EwayBill>('/eway', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  cancel(id: string, reason?: string) {
    return api<EwayBill>(`/eway/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
};

