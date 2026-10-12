/**
 * UI-strana očekivanja za kontekst studija i trenutnog korisnika.
 *
 * PRIVREMENO: kad `packages/contracts` (Zod DTO) dobije ove tipove, ova datoteka
 * postaje re-export i ne smije se razilaziti od backend ugovora.
 */

export type StudioRole = 'owner' | 'manager' | 'artist';

/** Akcijske ovlasti koje UI koristi samo za skrivanje navigacije. Backend uvijek provjerava sam. */
export type StudioPermission =
  | 'bookings.view'
  | 'bookings.manage'
  | 'calendar.manage'
  | 'services.manage'
  | 'hours.manage'
  | 'team.manage'
  | 'portfolio.manage'
  | 'analytics.view'
  | 'studio.settings.manage';

export type StudioSummary = {
  id: string;
  slug: string;
  name: string;
  /** IANA, npr. "Europe/Zagreb". */
  timezone: string;
  /** ISO 4217, npr. "EUR". */
  currency: string;
  branding: {
    accentColor: string | null;
    logoUrl: string | null;
  };
};

export type Viewer = {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

export type StudioViewerContext = {
  studio: StudioSummary;
  viewer: Viewer;
  membership: {
    role: StudioRole;
    permissions: StudioPermission[];
  };
};
