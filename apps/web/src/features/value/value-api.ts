import type { ArtistValueAccount, CreditEntryCreate, HourPackage, HourPackageWrite, PackageEntryCreate, PackageGrant, ValueArtist } from '@studio/contracts';
import { apiFetch } from '../../lib/api/client';

const base = (slug: string) => `/api/studios/${encodeURIComponent(slug)}`;
const mutationKey = () => crypto.randomUUID();

export const fetchHourPackages = (slug: string, signal?: AbortSignal) =>
  apiFetch<{ packages: HourPackage[] }>(`${base(slug)}/hour-packages`, { signal });
export const createHourPackage = (slug: string, input: HourPackageWrite) =>
  apiFetch<HourPackage>(`${base(slug)}/hour-packages`, { method: 'POST', body: input });
export const updateHourPackage = (slug: string, id: string, input: HourPackageWrite) =>
  apiFetch<HourPackage>(`${base(slug)}/hour-packages/${encodeURIComponent(id)}`, { method: 'PUT', body: input });
export const fetchValueArtists = (slug: string, signal?: AbortSignal) =>
  apiFetch<{ artists: ValueArtist[] }>(`${base(slug)}/value/artists`, { signal });
export const fetchValueAccount = (slug: string, userId: string, signal?: AbortSignal) =>
  apiFetch<ArtistValueAccount>(`${base(slug)}/value/accounts/${encodeURIComponent(userId)}`, { signal });
export const fetchOwnValueAccount = (slug: string, signal?: AbortSignal) =>
  apiFetch<ArtistValueAccount>(`${base(slug)}/value/me`, { signal });
export const grantPackage = (slug: string, input: PackageGrant) =>
  apiFetch<ArtistValueAccount>(`${base(slug)}/value/package-grants`, { method: 'POST', body: input, idempotencyKey: mutationKey() });
export const addPackageEntry = (slug: string, balanceId: string, input: PackageEntryCreate) =>
  apiFetch<ArtistValueAccount>(`${base(slug)}/value/package-balances/${encodeURIComponent(balanceId)}/entries`, { method: 'POST', body: input, idempotencyKey: mutationKey() });
export const addCreditEntry = (slug: string, input: CreditEntryCreate) =>
  apiFetch<ArtistValueAccount>(`${base(slug)}/value/credit-entries`, { method: 'POST', body: input, idempotencyKey: mutationKey() });
