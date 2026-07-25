export const PLATFORM_CLIENT_ID = 'PLATFORM';

export const PROFILE_DEFAULTS: Record<
  string,
  { invoiceTitle: string; partyLabel: string; partyIdLabel: string }
> = {
  HOSPITAL: {
    invoiceTitle: 'PATIENT BILLING / INVOICE',
    partyLabel: 'Patient Name',
    partyIdLabel: 'UHID',
  },
  SCHOOL: {
    invoiceTitle: 'FEE RECEIPT / INVOICE',
    partyLabel: 'Student Name',
    partyIdLabel: 'Admission No',
  },
  COMMERCIAL: {
    invoiceTitle: 'TAX INVOICE',
    partyLabel: 'Customer Name',
    partyIdLabel: 'Customer Code',
  },
  CLINIC: {
    invoiceTitle: 'CLINIC BILL / INVOICE',
    partyLabel: 'Patient Name',
    partyIdLabel: 'UHID',
  },
  RETAIL: {
    invoiceTitle: 'TAX INVOICE',
    partyLabel: 'Customer',
    partyIdLabel: 'Customer Code',
  },
  GENERIC: {
    invoiceTitle: 'TAX INVOICE',
    partyLabel: 'Customer',
    partyIdLabel: 'Customer Code',
  },
};
