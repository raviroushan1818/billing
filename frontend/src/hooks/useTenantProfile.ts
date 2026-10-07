import { useEffect, useState } from 'react';
import { tenantApi } from '../api';
import type { BusinessProfile, TenantMe } from '../types';

const PROFILE_DEFAULTS: Record<
  BusinessProfile,
  { partyLabel: string; partyIdLabel: string; invoiceTitle: string }
> = {
  HOSPITAL: {
    partyLabel: 'Patient Name',
    partyIdLabel: 'UHID',
    invoiceTitle: 'PATIENT BILLING / INVOICE',
  },
  SCHOOL: {
    partyLabel: 'Student Name',
    partyIdLabel: 'Admission No',
    invoiceTitle: 'FEE RECEIPT / INVOICE',
  },
  COMMERCIAL: {
    partyLabel: 'Customer Name',
    partyIdLabel: 'Customer Code',
    invoiceTitle: 'TAX INVOICE',
  },
  CLINIC: {
    partyLabel: 'Patient Name',
    partyIdLabel: 'UHID',
    invoiceTitle: 'CLINIC BILL / INVOICE',
  },
  RETAIL: {
    partyLabel: 'Customer',
    partyIdLabel: 'Customer Code',
    invoiceTitle: 'TAX INVOICE',
  },
  GENERIC: {
    partyLabel: 'Customer',
    partyIdLabel: 'Customer Code',
    invoiceTitle: 'TAX INVOICE',
  },
};

export function useTenantProfile() {
  const [tenant, setTenant] = useState<TenantMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tenantApi
      .me()
      .then(setTenant)
      .catch(() => setTenant(null))
      .finally(() => setLoading(false));
  }, []);

  const profileType = tenant?.profileType ?? 'GENERIC';
  const defaults = PROFILE_DEFAULTS[profileType];

  return {
    tenant,
    loading,
    profileType,
    partyLabel: tenant?.profileConfig?.partyLabel ?? defaults.partyLabel,
    partyIdLabel: tenant?.profileConfig?.partyIdLabel ?? defaults.partyIdLabel,
    invoiceTitle:
      tenant?.profileConfig?.invoiceTitle ?? defaults.invoiceTitle,
    showRefBy: profileType === 'HOSPITAL' || profileType === 'CLINIC',
    showPatientDemographics:
      profileType === 'HOSPITAL' || profileType === 'CLINIC',
    showGstinProminent: profileType === 'COMMERCIAL',
    showClassField: profileType === 'SCHOOL',
  };
}
