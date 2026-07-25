import { PrismaClient, UserRole, TenantStatus, BusinessProfile } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const PLATFORM_CLIENT_ID = 'PLATFORM';

const prisma = new PrismaClient();

const PLANS = [
  {
    code: 'STARTER',
    name: 'Starter',
    description: 'GST invoicing essentials for micro businesses',
    priceMonthlyInr: 199,
    priceYearlyInr: 1999,
    maxUsers: 2,
    maxInvoices: 1200,
    trialDays: 14,
    features: [
      'GST tax invoices & PDF',
      'Parties & items',
      'Basic branding',
      'Email share',
      '2 users',
    ],
    sortOrder: 1,
    isCustom: false,
  },
  {
    code: 'GROWTH',
    name: 'Growth',
    description: 'Most popular — multi-user GST billing with WhatsApp & branding',
    priceMonthlyInr: 349,
    priceYearlyInr: 3499,
    maxUsers: 5,
    maxInvoices: 6000,
    trialDays: 14,
    features: [
      'Everything in Starter',
      'WhatsApp share',
      'Advanced branding themes',
      'CSV import',
      'Recycle bin & RBAC',
      'SMTP integrations',
      'Partial payments & dues',
      '5 users',
      'whatsapp',
      'csvImport',
      'smtp',
      'partialPay',
      'notes',
    ],
    sortOrder: 2,
    isCustom: false,
  },
  {
    code: 'BUSINESS',
    name: 'Business',
    description: 'Higher limits for growing teams and multi-admin shops',
    priceMonthlyInr: 599,
    priceYearlyInr: 5999,
    maxUsers: 15,
    maxInvoices: 25000,
    trialDays: 14,
    features: [
      'Everything in Growth',
      '15 users',
      '25,000 invoices / year',
      'Priority support flag',
      'Credit & debit notes',
      'Workspace notes',
      'Inventory stock tracking',
      'whatsapp',
      'csvImport',
      'smtp',
      'partialPay',
      'creditNotes',
      'notes',
      'stock',
    ],
    sortOrder: 3,
    isCustom: false,
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'Custom limits and pricing — contact Platform Admin',
    priceMonthlyInr: 0,
    priceYearlyInr: 0,
    maxUsers: 50,
    maxInvoices: 100000,
    trialDays: 14,
    features: [
      'Custom users & invoice limits',
      'Dedicated onboarding',
      'Custom SLA',
      'whatsapp',
      'csvImport',
      'smtp',
      'partialPay',
      'creditNotes',
      'notes',
      'stock',
    ],
    sortOrder: 4,
    isCustom: true,
    isPublic: true,
  },
] as const;

async function seedPlans() {
  for (const p of PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { code: p.code },
      create: {
        code: p.code,
        name: p.name,
        description: p.description,
        priceMonthlyInr: p.priceMonthlyInr,
        priceYearlyInr: p.priceYearlyInr,
        maxUsers: p.maxUsers,
        maxInvoices: p.maxInvoices,
        trialDays: p.trialDays,
        features: [...p.features],
        sortOrder: p.sortOrder,
        isCustom: p.isCustom,
        isPublic: true,
        isActive: true,
      },
      update: {
        name: p.name,
        description: p.description,
        priceMonthlyInr: p.priceMonthlyInr,
        priceYearlyInr: p.priceYearlyInr,
        maxUsers: p.maxUsers,
        maxInvoices: p.maxInvoices,
        trialDays: p.trialDays,
        features: [...p.features],
        sortOrder: p.sortOrder,
        isCustom: p.isCustom,
        isActive: true,
      },
    });
  }
  console.log(`Seeded ${PLANS.length} subscription plans`);
}

async function main() {
  const email = process.env.SEED_SUPERADMIN_EMAIL ?? 'admin@indiansoftwareservices.com';
  const password = process.env.SEED_SUPERADMIN_PASSWORD ?? 'ChangeMeAdmin123!';

  const tenant = await prisma.tenant.upsert({
    where: { clientId: PLATFORM_CLIENT_ID },
    create: {
      clientId: PLATFORM_CLIENT_ID,
      name: 'Platform',
      legalName: 'Billing Platform',
      profileType: BusinessProfile.GENERIC,
      status: TenantStatus.ACTIVE,
      planCode: 'PLATFORM',
      maxUsers: 100,
      maxInvoices: 999999,
      profileConfig: {
        create: {
          profileType: BusinessProfile.GENERIC,
          invoiceTitle: 'TAX INVOICE',
          partyLabel: 'Customer',
          partyIdLabel: 'Customer Code',
        },
      },
      brandTemplate: {
        create: {
          invoiceTitle: 'TAX INVOICE',
        },
      },
    },
    update: {
      status: TenantStatus.ACTIVE,
    },
  });

  const hash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: email.toLowerCase(),
      },
    },
    create: {
      tenantId: tenant.id,
      email: email.toLowerCase(),
      password: hash,
      firstName: 'Super',
      lastName: 'Admin',
      role: UserRole.SUPER_ADMIN,
    },
    update: {
      password: hash,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  await seedPlans();

  const settings = await prisma.platformPaymentSettings.findFirst();
  if (!settings) {
    await prisma.platformPaymentSettings.create({
      data: {
        gatewayEnabled: false,
        manualUpiId: null,
        manualBankDetails:
          'Pay via UPI/NEFT and share UTR with Platform Admin to activate your plan.',
      },
    });
  }

  console.log(`Seeded PLATFORM tenant (${PLATFORM_CLIENT_ID})`);
  console.log(`Super admin: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
