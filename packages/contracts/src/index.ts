import { z } from 'zod';

export const apiErrorSchema = z.object({
  code: z.string().min(1).optional(),
  message: z.string().min(1).optional(),
  fieldErrors: z.record(z.string(), z.string()).optional(),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export const studioRoleSchema = z.enum(['owner', 'manager', 'artist']);
export type StudioRole = z.infer<typeof studioRoleSchema>;

export const studioPermissionSchema = z.enum([
  'bookings.view',
  'bookings.manage',
  'calendar.manage',
  'services.manage',
  'hours.manage',
  'team.manage',
  'portfolio.manage',
  'credits.manage',
  'promos.manage',
  'analytics.view',
  'studio.settings.manage',
]);
export type StudioPermission = z.infer<typeof studioPermissionSchema>;

export const studioSummarySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  timezone: z.string().min(1),
  currency: z.string().regex(/^[A-Z]{3}$/),
  branding: z.object({
    accentColor: z.string().regex(/^#[0-9a-f]{6}$/i).nullable(),
    logoUrl: z.url().nullable(),
  }),
});
export type StudioSummary = z.infer<typeof studioSummarySchema>;

export const viewerSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  email: z.email(),
  avatarUrl: z.url().nullable(),
});
export type Viewer = z.infer<typeof viewerSchema>;

export const studioViewerContextSchema = z.object({
  studio: studioSummarySchema,
  viewer: viewerSchema,
  membership: z.object({
    role: studioRoleSchema,
    permissions: z.array(studioPermissionSchema),
  }),
});
export type StudioViewerContext = z.infer<typeof studioViewerContextSchema>;

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('studio-cener-api'),
  environment: z.string().min(1),
  checks: z.object({ database: z.literal('ok') }),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const serviceStatusSchema = z.enum(['active', 'archived']);
export const serviceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable(),
  durationMinutes: z.number().int().min(15).max(720).refine((value) => value % 15 === 0),
  priceMinor: z.number().int().min(0),
  currency: z.string().regex(/^[A-Z]{3}$/),
  status: serviceStatusSchema,
  sortOrder: z.number().int().min(0),
});
export type Service = z.infer<typeof serviceSchema>;

export const serviceWriteSchema = z.object({
  name: z.string().trim().min(2, 'Unesite naziv usluge.').max(100),
  description: z.string().trim().max(500).nullable().optional(),
  durationMinutes: z.number().int().min(15).max(720).refine((value) => value % 15 === 0, 'Trajanje mora biti u koracima od 15 minuta.'),
  priceMinor: z.number().int().min(0).max(10_000_000),
  status: serviceStatusSchema.optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});
export type ServiceWrite = z.infer<typeof serviceWriteSchema>;

const availabilityRuleFieldsSchema = z.object({
  id: z.string().min(1),
  weekday: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
});
export const availabilityRuleSchema = availabilityRuleFieldsSchema.refine((rule) => rule.endMinute > rule.startMinute, { path: ['endMinute'], message: 'Završetak mora biti nakon početka.' });
export type AvailabilityRule = z.infer<typeof availabilityRuleSchema>;

export const availabilityRulesWriteSchema = z.object({
  rules: z.array(availabilityRuleFieldsSchema.omit({ id: true }).refine((rule) => rule.endMinute > rule.startMinute, {
    path: ['endMinute'],
    message: 'Završetak mora biti nakon početka.',
  })).max(7),
});
export type AvailabilityRulesWrite = z.infer<typeof availabilityRulesWriteSchema>;

export const studioSettingsSchema = studioSummarySchema.extend({
  description: z.string().nullable(),
  address: z.string().nullable(),
});
export type StudioSettings = z.infer<typeof studioSettingsSchema>;

export const studioSettingsWriteSchema = z.object({
  name: z.string().trim().min(2, 'Unesite naziv studija.').max(100),
  description: z.string().trim().max(1000).nullable(),
  address: z.string().trim().max(300).nullable(),
  accentColor: z.string().regex(/^#[0-9a-f]{6}$/i, 'Unesite boju u formatu #76543b.').nullable(),
});
export type StudioSettingsWrite = z.infer<typeof studioSettingsWriteSchema>;

export const teamMemberStatusSchema = z.enum(['active', 'hidden']);
export const teamMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  roleTitle: z.string().min(1).max(100),
  bio: z.string().max(1000).nullable(),
  imageUrl: z.url().nullable(),
  status: teamMemberStatusSchema,
  sortOrder: z.number().int().min(0),
});
export type TeamMember = z.infer<typeof teamMemberSchema>;

export const teamMemberWriteSchema = z.object({
  name: z.string().trim().min(2, 'Unesite ime člana tima.').max(100),
  roleTitle: z.string().trim().min(2, 'Unesite ulogu člana tima.').max(100),
  bio: z.string().trim().max(1000).nullable(),
  status: teamMemberStatusSchema.optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});
export type TeamMemberWrite = z.infer<typeof teamMemberWriteSchema>;

export const portfolioStatusSchema = z.enum(['draft', 'published']);
export const portfolioProjectSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(150),
  artistName: z.string().min(1).max(100),
  description: z.string().max(1000).nullable(),
  imageUrl: z.url().nullable(),
  status: portfolioStatusSchema,
  sortOrder: z.number().int().min(0),
});
export type PortfolioProject = z.infer<typeof portfolioProjectSchema>;

export const portfolioProjectWriteSchema = z.object({
  title: z.string().trim().min(2, 'Unesite naziv projekta.').max(150),
  artistName: z.string().trim().min(2, 'Unesite ime artista.').max(100),
  description: z.string().trim().max(1000).nullable(),
  status: portfolioStatusSchema.optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});
export type PortfolioProjectWrite = z.infer<typeof portfolioProjectWriteSchema>;

export const publicStudioSchema = z.object({
  studio: studioSummarySchema.extend({
    description: z.string().nullable(),
    address: z.string().nullable(),
  }),
  services: z.array(serviceSchema),
  availabilityRules: z.array(availabilityRuleSchema),
  teamMembers: z.array(teamMemberSchema),
  portfolioProjects: z.array(portfolioProjectSchema),
});
export type PublicStudio = z.infer<typeof publicStudioSchema>;

export const bookingStatusSchema = z.enum(['confirmed', 'cancelled', 'completed', 'no_show']);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;
export const bookingPaymentMethodSchema = z.enum(['none', 'credit', 'package']);
export type BookingPaymentMethod = z.infer<typeof bookingPaymentMethodSchema>;
export const bookingSchema = z.object({
  id: z.string().min(1),
  studioId: z.string().min(1),
  resourceId: z.string().min(1),
  artistUserId: z.string().min(1),
  serviceId: z.string().min(1),
  startAtUtc: z.iso.datetime({ offset: true }),
  endAtUtc: z.iso.datetime({ offset: true }),
  status: bookingStatusSchema,
  serviceName: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  priceMinor: z.number().int().min(0),
  subtotalPriceMinor: z.number().int().min(0),
  discountMinor: z.number().int().min(0),
  promoCode: z.string().nullable(),
  artistName: z.string().nullable(),
  artistEmail: z.email().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  paymentMethod: bookingPaymentMethodSchema,
  packageBalanceId: z.string().nullable(),
  creditAmountMinor: z.number().int().min(0),
  packageMinutes: z.number().int().min(0),
  valueRefundedAt: z.iso.datetime({ offset: true }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type Booking = z.infer<typeof bookingSchema>;
export const bookingListResponseSchema = z.object({
  bookings: z.array(bookingSchema),
  nextCursor: z.string().min(1).nullable(),
});
export type BookingListResponse = z.infer<typeof bookingListResponseSchema>;
export type BookingListFilters = {
  search?: string;
  status?: z.infer<typeof bookingStatusSchema>;
  fromDate?: string;
  toDate?: string;
  cursor?: string;
};

export const bookingCreateSchema = z.object({
  serviceId: z.string().min(1),
  startAtUtc: z.iso.datetime({ offset: true }),
  promoCode: z.string().trim().toUpperCase().min(2).max(40).optional(),
  paymentMethod: bookingPaymentMethodSchema.optional(),
  packageBalanceId: z.string().min(1).optional(),
});
export type BookingCreate = z.infer<typeof bookingCreateSchema>;
export const managedBookingCreateSchema = bookingCreateSchema.extend({ artistUserId: z.string().min(1) });
export type ManagedBookingCreate = z.infer<typeof managedBookingCreateSchema>;
export const bookingStatusUpdateSchema = z.object({ status: z.enum(['completed', 'no_show']) });
export type BookingStatusUpdate = z.infer<typeof bookingStatusUpdateSchema>;
export const bookingRescheduleSchema = z.object({ startAtUtc: z.iso.datetime({ offset: true }) });
export type BookingReschedule = z.infer<typeof bookingRescheduleSchema>;
export const bookingNoteCreateSchema = z.object({ body: z.string().trim().min(1, 'Unesite bilješku.').max(1000) });
export type BookingNoteCreate = z.infer<typeof bookingNoteCreateSchema>;
export const bookingTimelineEntrySchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string().min(1),
    kind: z.literal('event'),
    eventType: z.enum(['created', 'cancelled', 'completed', 'no_show', 'rescheduled']),
    actorName: z.string().nullable(),
    createdAt: z.iso.datetime({ offset: true }),
  }),
  z.object({
    id: z.string().min(1),
    kind: z.literal('note'),
    body: z.string().min(1).max(1000),
    actorName: z.string().nullable(),
    createdAt: z.iso.datetime({ offset: true }),
  }),
]);
export type BookingTimelineEntry = z.infer<typeof bookingTimelineEntrySchema>;
export const bookingDetailSchema = z.object({
  booking: bookingSchema,
  timeline: z.array(bookingTimelineEntrySchema),
});
export type BookingDetail = z.infer<typeof bookingDetailSchema>;

export const bookingSlotSchema = z.object({
  startAtUtc: z.iso.datetime({ offset: true }),
  endAtUtc: z.iso.datetime({ offset: true }),
});
export type BookingSlot = z.infer<typeof bookingSlotSchema>;

export const bookingAvailabilitySchema = z.object({
  date: z.iso.date(),
  timezone: z.string().min(1),
  serviceId: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  slots: z.array(bookingSlotSchema),
});
export type BookingAvailability = z.infer<typeof bookingAvailabilitySchema>;

export const blockedSlotSchema = z.object({
  id: z.string().min(1),
  studioId: z.string().min(1),
  resourceId: z.string().min(1),
  startAtUtc: z.iso.datetime({ offset: true }),
  endAtUtc: z.iso.datetime({ offset: true }),
  reason: z.string().min(2).max(200),
  createdAt: z.iso.datetime({ offset: true }),
});
export type BlockedSlot = z.infer<typeof blockedSlotSchema>;

const localDateTimeSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Unesite valjani datum i vrijeme.');
export const blockedSlotCreateSchema = z.object({
  startLocal: localDateTimeSchema,
  endLocal: localDateTimeSchema,
  reason: z.string().trim().min(2, 'Unesite razlog blokade.').max(200),
});
export type BlockedSlotCreate = z.infer<typeof blockedSlotCreateSchema>;

export const licensePlanSchema = z.enum(['starter', 'pro', 'custom']);
export const licenseStatusSchema = z.enum(['trial', 'active', 'grace', 'suspended', 'expired']);
export const domainStatusSchema = z.enum(['pending', 'active', 'failed']);

export const platformStudioSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(['active', 'suspended', 'archived']),
  ownerEmail: z.email().nullable(),
  license: z.object({
    plan: licensePlanSchema,
    status: licenseStatusSchema,
    expiresAt: z.iso.datetime({ offset: true }),
  }),
  domain: z.object({ hostname: z.string().min(1), status: domainStatusSchema, sslStatus: domainStatusSchema }).nullable(),
});
export type PlatformStudio = z.infer<typeof platformStudioSchema>;

export const platformStudioCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(63),
  ownerEmail: z.email(),
  timezone: z.string().trim().min(1).max(100),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  plan: licensePlanSchema,
  expiresAt: z.iso.datetime({ offset: true }),
  hostname: z.string().trim().toLowerCase().max(253).optional(),
});
export type PlatformStudioCreate = z.infer<typeof platformStudioCreateSchema>;

export const platformStudioCreatedSchema = z.object({
  studio: platformStudioSchema,
  invitationToken: z.string().min(32),
});
export type PlatformStudioCreated = z.infer<typeof platformStudioCreatedSchema>;

export const licenseUpdateSchema = z.object({
  plan: licensePlanSchema,
  status: licenseStatusSchema,
  expiresAt: z.iso.datetime({ offset: true }),
});
export type LicenseUpdate = z.infer<typeof licenseUpdateSchema>;

export const invitationAcceptSchema = z.object({ token: z.string().min(32).max(256) });
export const invitationAcceptedSchema = z.object({ studioSlug: z.string().min(1), role: z.enum(['owner', 'manager']) });
export type InvitationAccepted = z.infer<typeof invitationAcceptedSchema>;

export const studioAccessMemberSchema = z.object({
  membershipId: z.string().min(1),
  userId: z.string().min(1),
  name: z.string().min(1),
  email: z.email(),
  role: z.enum(['owner', 'manager']),
  status: z.enum(['active', 'suspended', 'revoked']),
  teamMemberId: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type StudioAccessMember = z.infer<typeof studioAccessMemberSchema>;

export const studioAccessInvitationSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  role: z.literal('manager'),
  teamMemberId: z.string().nullable(),
  expiresAt: z.iso.datetime({ offset: true }),
  createdAt: z.iso.datetime({ offset: true }),
});
export type StudioAccessInvitation = z.infer<typeof studioAccessInvitationSchema>;

export const studioAccessSchema = z.object({
  members: z.array(studioAccessMemberSchema),
  invitations: z.array(studioAccessInvitationSchema),
  managerLimit: z.number().int().min(0),
  managerSlotsUsed: z.number().int().min(0),
});
export type StudioAccess = z.infer<typeof studioAccessSchema>;

export const managerInvitationCreateSchema = z.object({
  email: z.email('Unesite valjanu e-mail adresu.').transform((value) => value.trim().toLowerCase()),
  teamMemberId: z.string().min(1).nullable().optional(),
});
export type ManagerInvitationCreate = z.input<typeof managerInvitationCreateSchema>;

export const managerInvitationCreatedSchema = z.object({
  invitation: studioAccessInvitationSchema,
  invitationToken: z.string().min(32),
});
export type ManagerInvitationCreated = z.infer<typeof managerInvitationCreatedSchema>;

export const hourPackageStatusSchema = z.enum(['active', 'archived']);
export const hourPackageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable(),
  includedMinutes: z.number().int().min(15).max(60_000),
  priceMinor: z.number().int().min(0),
  currency: z.string().regex(/^[A-Z]{3}$/),
  validityDays: z.number().int().min(1).max(3650).nullable(),
  status: hourPackageStatusSchema,
  sortOrder: z.number().int().min(0),
});
export type HourPackage = z.infer<typeof hourPackageSchema>;

export const hourPackageWriteSchema = z.object({
  name: z.string().trim().min(2, 'Unesite naziv paketa.').max(100),
  description: z.string().trim().max(500).nullable().optional(),
  includedMinutes: z.number().int().min(15).max(60_000).refine((value) => value % 15 === 0, 'Minute moraju biti u koracima od 15.'),
  priceMinor: z.number().int().min(0).max(100_000_000),
  validityDays: z.number().int().min(1).max(3650).nullable().optional(),
  status: hourPackageStatusSchema.optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});
export type HourPackageWrite = z.infer<typeof hourPackageWriteSchema>;

export const valueArtistSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(1),
  email: z.email(),
});
export type ValueArtist = z.infer<typeof valueArtistSchema>;

export const packageBalanceSchema = z.object({
  id: z.string().min(1),
  packageId: z.string().min(1),
  packageName: z.string().min(1),
  grantedMinutes: z.number().int().positive(),
  remainingMinutes: z.number().int().min(0),
  expiresAt: z.iso.datetime({ offset: true }).nullable(),
  status: z.enum(['active', 'exhausted', 'expired']),
  createdAt: z.iso.datetime({ offset: true }),
});
export type PackageBalance = z.infer<typeof packageBalanceSchema>;

export const packageLedgerKindSchema = z.enum(['grant', 'use', 'refund', 'adjustment', 'expiry']);
export const packageLedgerEntrySchema = z.object({
  id: z.string().min(1),
  packageBalanceId: z.string().min(1),
  amountMinutes: z.number().int().refine((value) => value !== 0),
  kind: packageLedgerKindSchema,
  reason: z.string().min(2).max(300),
  actorName: z.string().min(1),
  createdAt: z.iso.datetime({ offset: true }),
});
export type PackageLedgerEntry = z.infer<typeof packageLedgerEntrySchema>;

export const creditLedgerKindSchema = z.enum(['grant', 'use', 'refund', 'adjustment']);
export const creditLedgerEntrySchema = z.object({
  id: z.string().min(1),
  amountMinor: z.number().int().refine((value) => value !== 0),
  currency: z.string().regex(/^[A-Z]{3}$/),
  kind: creditLedgerKindSchema,
  reason: z.string().min(2).max(300),
  actorName: z.string().min(1),
  createdAt: z.iso.datetime({ offset: true }),
});
export type CreditLedgerEntry = z.infer<typeof creditLedgerEntrySchema>;

export const artistValueAccountSchema = z.object({
  artist: valueArtistSchema,
  creditBalanceMinor: z.number().int().min(0),
  currency: z.string().regex(/^[A-Z]{3}$/),
  packageBalances: z.array(packageBalanceSchema),
  packageLedger: z.array(packageLedgerEntrySchema),
  creditLedger: z.array(creditLedgerEntrySchema),
});
export type ArtistValueAccount = z.infer<typeof artistValueAccountSchema>;

export const packageGrantSchema = z.object({
  userId: z.string().min(1),
  packageId: z.string().min(1),
  reason: z.string().trim().min(2, 'Unesite razlog dodjele.').max(300),
});
export type PackageGrant = z.infer<typeof packageGrantSchema>;

export const packageEntryCreateSchema = z.object({
  amountMinutes: z.number().int().min(-60_000).max(60_000).refine((value) => value !== 0 && value % 15 === 0, 'Promjena mora biti u koracima od 15 minuta.'),
  kind: z.enum(['use', 'refund', 'adjustment']),
  reason: z.string().trim().min(2, 'Unesite razlog promjene.').max(300),
});
export type PackageEntryCreate = z.infer<typeof packageEntryCreateSchema>;

export const creditEntryCreateSchema = z.object({
  userId: z.string().min(1),
  amountMinor: z.number().int().min(-100_000_000).max(100_000_000).refine((value) => value !== 0),
  kind: creditLedgerKindSchema,
  reason: z.string().trim().min(2, 'Unesite razlog promjene.').max(300),
});
export type CreditEntryCreate = z.infer<typeof creditEntryCreateSchema>;

export const promoCodeStatusSchema = z.enum(['active', 'archived']);
export const promoDiscountTypeSchema = z.enum(['percentage', 'fixed']);
export const promoCodeSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(2).max(40),
  description: z.string().max(300).nullable(),
  discountType: promoDiscountTypeSchema,
  discountValue: z.number().int().positive(),
  maxDiscountMinor: z.number().int().positive().nullable(),
  minimumSpendMinor: z.number().int().min(0),
  validFrom: z.iso.datetime({ offset: true }),
  validUntil: z.iso.datetime({ offset: true }),
  maxRedemptions: z.number().int().positive().nullable(),
  maxRedemptionsPerUser: z.number().int().positive(),
  redemptionCount: z.number().int().min(0),
  status: promoCodeStatusSchema,
});
export type PromoCode = z.infer<typeof promoCodeSchema>;

export const promoCodeWriteSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,40}$/, 'Koristite slova, brojeve, crticu ili donju crtu.'),
  description: z.string().trim().max(300).nullable().optional(),
  discountType: promoDiscountTypeSchema,
  discountValue: z.number().int().positive().max(100_000_000),
  maxDiscountMinor: z.number().int().positive().max(100_000_000).nullable().optional(),
  minimumSpendMinor: z.number().int().min(0).max(100_000_000).optional(),
  validFrom: z.iso.datetime({ offset: true }),
  validUntil: z.iso.datetime({ offset: true }),
  maxRedemptions: z.number().int().positive().max(1_000_000).nullable().optional(),
  maxRedemptionsPerUser: z.number().int().positive().max(10_000).optional(),
  status: promoCodeStatusSchema.optional(),
}).superRefine((value, context) => {
  if (value.discountType === 'percentage' && value.discountValue > 100) context.addIssue({ code: 'custom', path: ['discountValue'], message: 'Postotak ne može biti veći od 100.' });
  if (Date.parse(value.validUntil) <= Date.parse(value.validFrom)) context.addIssue({ code: 'custom', path: ['validUntil'], message: 'Završetak mora biti nakon početka.' });
});
export type PromoCodeWrite = z.infer<typeof promoCodeWriteSchema>;

export const promoQuoteRequestSchema = z.object({
  serviceId: z.string().min(1),
  code: z.string().trim().toUpperCase().min(2).max(40),
});
export const promoQuoteSchema = z.object({
  code: z.string().min(1),
  subtotalPriceMinor: z.number().int().min(0),
  discountMinor: z.number().int().min(0),
  totalPriceMinor: z.number().int().min(0),
  currency: z.string().regex(/^[A-Z]{3}$/),
});
export type PromoQuoteRequest = z.infer<typeof promoQuoteRequestSchema>;
export type PromoQuote = z.infer<typeof promoQuoteSchema>;

export const waitlistStatusSchema = z.enum(['active', 'notified', 'cancelled', 'converted', 'expired']);
export const waitlistEntrySchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  artistName: z.string().min(1),
  artistEmail: z.email(),
  serviceId: z.string().min(1),
  serviceName: z.string().min(1),
  desiredDate: z.iso.date(),
  status: waitlistStatusSchema,
  notificationCount: z.number().int().min(0),
  lastNotifiedAt: z.iso.datetime({ offset: true }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type WaitlistEntry = z.infer<typeof waitlistEntrySchema>;

export const waitlistCreateSchema = z.object({
  serviceId: z.string().min(1),
  desiredDate: z.iso.date(),
});
export type WaitlistCreate = z.infer<typeof waitlistCreateSchema>;

export const notificationSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['waitlist_slot_available', 'booking_created', 'booking_cancelled', 'booking_rescheduled', 'system']),
  title: z.string().min(1).max(150),
  body: z.string().min(1).max(1000),
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  readAt: z.iso.datetime({ offset: true }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});
export type Notification = z.infer<typeof notificationSchema>;

export const analyticsRangeSchema = z.enum(['30d', '90d', '365d']);
export type AnalyticsRange = z.infer<typeof analyticsRangeSchema>;
export const studioAnalyticsSchema = z.object({
  range: analyticsRangeSchema,
  fromDate: z.iso.date(),
  toDate: z.iso.date(),
  timezone: z.string().min(1),
  currency: z.string().regex(/^[A-Z]{3}$/),
  summary: z.object({
    totalBookings: z.number().int().min(0),
    confirmedBookings: z.number().int().min(0),
    completedBookings: z.number().int().min(0),
    cancelledBookings: z.number().int().min(0),
    uniqueArtists: z.number().int().min(0),
    returningArtists: z.number().int().min(0),
    bookingValueMinor: z.number().int().min(0),
    bookedMinutes: z.number().int().min(0),
    availableMinutes: z.number().int().min(0),
    utilizationPercent: z.number().min(0).max(100),
  }),
  topServices: z.array(z.object({
    serviceId: z.string().min(1),
    serviceName: z.string().min(1),
    bookings: z.number().int().min(0),
    valueMinor: z.number().int().min(0),
  })),
  daily: z.array(z.object({
    date: z.iso.date(),
    bookings: z.number().int().min(0),
    valueMinor: z.number().int().min(0),
    bookedMinutes: z.number().int().min(0),
  })),
});
export type StudioAnalytics = z.infer<typeof studioAnalyticsSchema>;

export const studioOverviewSchema = z.object({
  date: z.iso.date(),
  timezone: z.string().min(1),
  currency: z.string().regex(/^[A-Z]{3}$/),
  summary: z.object({
    todayBookings: z.number().int().min(0),
    todayBookingValueMinor: z.number().int().min(0),
    nextSevenDaysBookings: z.number().int().min(0),
    activeWaitlistEntries: z.number().int().min(0),
  }),
  attention: z.object({
    hasActiveServices: z.boolean(),
    hasAvailabilityRules: z.boolean(),
    activeWaitlistEntries: z.number().int().min(0),
  }),
  today: z.array(z.object({
    id: z.string().min(1),
    artistName: z.string().min(1),
    artistEmail: z.email(),
    serviceName: z.string().min(1),
    startAtUtc: z.iso.datetime({ offset: true }),
    endAtUtc: z.iso.datetime({ offset: true }),
    status: bookingStatusSchema,
    priceMinor: z.number().int().min(0),
  })),
});
export type StudioOverview = z.infer<typeof studioOverviewSchema>;
