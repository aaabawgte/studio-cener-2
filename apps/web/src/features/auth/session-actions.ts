import { apiFetch } from '../../lib/api/client';
import { USE_MOCKS } from '../../lib/env';

/**
 * Odjava. PRIVREMENO: kad auth core izloži Better Auth klijent u web aplikaciji,
 * zamijeniti pozivom `authClient.signOut()` — ovdje se namjerno ne dira auth logika.
 */
export async function signOut(): Promise<void> {
  if (USE_MOCKS) return;
  await apiFetch<void>('/api/auth/sign-out', { method: 'POST', body: {} });
}

/** Ruta prijave još ne postoji; dogovoriti s auth ownerom. */
export function loginUrl(next: string): string {
  return `/prijava?next=${encodeURIComponent(next)}`;
}
