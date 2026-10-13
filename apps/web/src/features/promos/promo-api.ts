import type { PromoCode, PromoCodeWrite, PromoQuote, PromoQuoteRequest } from '@studio/contracts';
import { apiFetch } from '../../lib/api/client';

const base = (slug: string) => `/api/studios/${encodeURIComponent(slug)}`;
export const fetchPromoCodes = (slug: string, signal?: AbortSignal) => apiFetch<{ promoCodes: PromoCode[] }>(`${base(slug)}/promo-codes`, { signal });
export const createPromoCode = (slug: string, input: PromoCodeWrite) => apiFetch<PromoCode>(`${base(slug)}/promo-codes`, { method: 'POST', body: input });
export const updatePromoCode = (slug: string, id: string, input: PromoCodeWrite) => apiFetch<PromoCode>(`${base(slug)}/promo-codes/${encodeURIComponent(id)}`, { method: 'PUT', body: input });
export const validatePromo = (slug: string, input: PromoQuoteRequest) => apiFetch<PromoQuote>(`${base(slug)}/promo-codes/validate`, { method: 'POST', body: input });
