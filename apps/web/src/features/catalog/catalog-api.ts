import type { AvailabilityRule, PublicStudio, Service, ServiceWrite } from '@studio/contracts';
import { apiFetch } from '../../lib/api/client';
import { USE_MOCKS } from '../../lib/env';

export type AvailabilityResponse = { rules: AvailabilityRule[]; timezone: string };

export async function fetchServices(slug: string, signal?: AbortSignal) {
  if (USE_MOCKS) return (await import('../../mocks/catalog')).mockServices(signal);
  return apiFetch<{ services: Service[] }>(`/api/studios/${encodeURIComponent(slug)}/services`, { signal });
}

export async function createService(slug: string, input: ServiceWrite) {
  if (USE_MOCKS) return (await import('../../mocks/catalog')).mockCreateService(input);
  return apiFetch<Service>(`/api/studios/${encodeURIComponent(slug)}/services`, { method: 'POST', body: input });
}

export async function updateService(slug: string, id: string, input: ServiceWrite) {
  if (USE_MOCKS) return (await import('../../mocks/catalog')).mockUpdateService(id, input);
  return apiFetch<Service>(`/api/studios/${encodeURIComponent(slug)}/services/${encodeURIComponent(id)}`, { method: 'PUT', body: input });
}

export async function fetchAvailability(slug: string, signal?: AbortSignal) {
  if (USE_MOCKS) return (await import('../../mocks/catalog')).mockAvailability(signal);
  return apiFetch<AvailabilityResponse>(`/api/studios/${encodeURIComponent(slug)}/availability-rules`, { signal });
}

export async function saveAvailability(slug: string, rules: Omit<AvailabilityRule, 'id'>[]) {
  if (USE_MOCKS) return (await import('../../mocks/catalog')).mockSaveAvailability(rules);
  return apiFetch<AvailabilityResponse>(`/api/studios/${encodeURIComponent(slug)}/availability-rules`, {
    method: 'PUT',
    body: { rules },
  });
}

export async function fetchPublicStudio(slug: string, signal?: AbortSignal) {
  if (USE_MOCKS) return (await import('../../mocks/catalog')).mockPublicStudio(slug, signal);
  return apiFetch<PublicStudio>(`/api/public/studios/${encodeURIComponent(slug)}`, { signal });
}
