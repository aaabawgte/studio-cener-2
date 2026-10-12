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

export const publicStudioSchema = z.object({
  studio: studioSummarySchema.extend({
    description: z.string().nullable(),
    address: z.string().nullable(),
  }),
  services: z.array(serviceSchema),
  availabilityRules: z.array(availabilityRuleSchema),
});
export type PublicStudio = z.infer<typeof publicStudioSchema>;
