import type { UserRole } from '../types';

export const PLATFORM_ROLES: UserRole[] = ['SUPER_ADMIN'];

export const APP_ROLES: UserRole[] = [
  'CLIENT_ADMIN',
  'BILLING_OPERATOR',
  'ACCOUNTANT',
  'VIEWER',
];

export const TENANT_ASSIGNABLE_ROLES: Array<{
  value: UserRole;
  label: string;
  hint: string;
}> = [
  {
    value: 'CLIENT_ADMIN',
    label: 'Owner',
    hint: 'Full control — users, settings, empty recycle bin',
  },
  {
    value: 'BILLING_OPERATOR',
    label: 'Staff',
    hint: 'Create and finalize bills; restore from recycle bin',
  },
  {
    value: 'ACCOUNTANT',
    label: 'Accountant',
    hint: 'Void bills, reports, restore from recycle bin',
  },
  {
    value: 'VIEWER',
    label: 'Viewer',
    hint: 'Read-only access to bills and reports',
  },
];

export function roleHome(role: string): string {
  if (role === 'SUPER_ADMIN') return '/platform';
  return '/app';
}

export function roleLabel(role: string): string {
  switch (role) {
    case 'CLIENT_ADMIN':
      return 'Owner';
    case 'BILLING_OPERATOR':
      return 'Staff';
    case 'ACCOUNTANT':
      return 'Accountant';
    case 'VIEWER':
      return 'Viewer';
    case 'SUPER_ADMIN':
      return 'Platform Admin';
    default:
      return role;
  }
}

export function canManageSettings(role: string): boolean {
  return role === 'CLIENT_ADMIN';
}

export function canManageUsers(role: string): boolean {
  return role === 'CLIENT_ADMIN';
}

export function canCreateBills(role: string): boolean {
  return role === 'CLIENT_ADMIN' || role === 'BILLING_OPERATOR';
}

export function canVoidBills(role: string): boolean {
  return role === 'CLIENT_ADMIN' || role === 'ACCOUNTANT';
}

export function canSoftDelete(role: string): boolean {
  return (
    role === 'CLIENT_ADMIN' ||
    role === 'BILLING_OPERATOR' ||
    role === 'ACCOUNTANT'
  );
}

export function canAccessRecycleBin(role: string): boolean {
  return canSoftDelete(role);
}

export function canEmptyRecycleBin(role: string): boolean {
  return role === 'CLIENT_ADMIN';
}

export function actorDisplayName(actor?: {
  firstName?: string;
  lastName?: string;
  email?: string;
} | null): string {
  if (!actor) return '—';
  if (actor.email?.endsWith('@indhms.bridge')) {
    return (actor.firstName || '').trim() || actor.email;
  }
  const name = `${actor.firstName ?? ''} ${actor.lastName ?? ''}`.trim();
  return name || actor.email || '—';
}

/** Role badge text — IndHMS shadow users store hospital role in lastName. */
export function actorRoleLabel(actor?: {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
} | null): string | null {
  if (!actor) return null;
  if (actor.email?.endsWith('@indhms.bridge') && actor.lastName) {
    return actor.lastName;
  }
  return actor.role ? roleLabel(actor.role) : null;
}
