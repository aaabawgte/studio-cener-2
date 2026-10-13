import type { IconName } from '@studio/ui';
import type { StudioPermission } from '../features/studio/types';

export type NavItem = {
  id: string;
  label: string;
  /** Kratka oznaka za bottom nav (max ~10 znakova). */
  shortLabel?: string;
  icon: IconName;
  /** Relativno na bazu shella ('' = index). */
  path: string;
  /** Prikaz u stabilnom bottom navu na mobitelu (max 4 po shellu). */
  bottomNav?: boolean;
  /** Samo skrivanje u UI-ju — server je jedini autoritet za pristup. */
  requires?: StudioPermission;
};

export type NavSection = { id: string; label: string; items: NavItem[] };

export const ownerNav: NavSection[] = [
  {
    id: 'work',
    label: 'Rad',
    items: [
      { id: 'overview', label: 'Pregled', icon: 'home', path: '', bottomNav: true },
      { id: 'calendar', label: 'Kalendar', icon: 'calendar', path: 'kalendar', bottomNav: true, requires: 'bookings.view' },
      { id: 'bookings', label: 'Rezervacije', shortLabel: 'Termini', icon: 'bookings', path: 'termini', bottomNav: true, requires: 'bookings.view' },
      { id: 'analytics', label: 'Analitika', icon: 'chart', path: 'analitika', bottomNav: true, requires: 'analytics.view' },
    ],
  },
  {
    id: 'studio',
    label: 'Studio',
    items: [
      { id: 'services', label: 'Usluge i cijene', icon: 'services', path: 'usluge', requires: 'services.manage' },
      { id: 'hours', label: 'Radno vrijeme', icon: 'clock', path: 'radno-vrijeme', requires: 'hours.manage' },
      { id: 'team', label: 'Tim', icon: 'team', path: 'tim', requires: 'team.manage' },
      { id: 'portfolio', label: 'Portfolio', icon: 'portfolio', path: 'portfolio', requires: 'portfolio.manage' },
      { id: 'credits', label: 'Paketi i krediti', icon: 'wallet', path: 'paketi-krediti', requires: 'credits.manage' },
      { id: 'promos', label: 'Promo kodovi', icon: 'services', path: 'promo-kodovi', requires: 'promos.manage' },
    ],
  },
  {
    id: 'account',
    label: 'Postavke',
    items: [
      { id: 'settings', label: 'Postavke studija', icon: 'settings', path: 'postavke', requires: 'studio.settings.manage' },
      { id: 'access', label: 'Pristupi', icon: 'user', path: 'pristupi', requires: 'studio.settings.manage' },
    ],
  },
];

export const artistNav: NavSection[] = [
  {
    id: 'main',
    label: 'Moj studio',
    items: [
      { id: 'home', label: 'Početna', icon: 'home', path: '', bottomNav: true },
      { id: 'book', label: 'Rezerviraj', icon: 'plus', path: 'rezerviraj', bottomNav: true },
      { id: 'bookings', label: 'Moji termini', shortLabel: 'Termini', icon: 'bookings', path: 'termini', bottomNav: true },
      { id: 'notifications', label: 'Obavijesti', icon: 'bell', path: 'obavijesti', bottomNav: true },
    ],
  },
  {
    id: 'account',
    label: 'Račun',
    items: [
      { id: 'credits', label: 'Krediti i paketi', icon: 'wallet', path: 'krediti' },
      { id: 'waitlist', label: 'Lista čekanja', icon: 'hourglass', path: 'lista-cekanja' },
      { id: 'profile', label: 'Profil', icon: 'user', path: 'profil' },
    ],
  },
];

export function filterNav(sections: NavSection[], permissions: readonly StudioPermission[] | null): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.requires || !permissions || permissions.includes(item.requires)),
    }))
    .filter((section) => section.items.length > 0);
}

export function findNavItem(sections: NavSection[], id: string): NavItem | undefined {
  return sections.flatMap((s) => s.items).find((i) => i.id === id);
}

export function joinPath(base: string, path: string): string {
  return path ? `${base}/${path}` : base;
}
