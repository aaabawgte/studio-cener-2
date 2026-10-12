import type { StudioPermission, StudioRole } from '@studio/contracts';

const ownerPermissions = [
  'bookings.view',
  'bookings.manage',
  'calendar.manage',
  'services.manage',
  'hours.manage',
  'team.manage',
  'portfolio.manage',
  'analytics.view',
  'studio.settings.manage',
] as const satisfies readonly StudioPermission[];

const managerPermissions = [
  'bookings.view',
  'bookings.manage',
  'calendar.manage',
  'services.manage',
  'hours.manage',
  'team.manage',
  'portfolio.manage',
  'analytics.view',
] as const satisfies readonly StudioPermission[];

export function permissionsForRole(role: StudioRole): StudioPermission[] {
  if (role === 'owner') return [...ownerPermissions];
  if (role === 'manager') return [...managerPermissions];
  return [];
}
