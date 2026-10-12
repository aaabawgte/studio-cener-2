import { authClient } from '../../lib/auth-client';
import { USE_MOCKS } from '../../lib/env';

export async function signOut(): Promise<void> {
  if (USE_MOCKS) return;
  const result = await authClient.signOut();
  if (result.error) throw new Error(result.error.message ?? 'Odjava nije uspjela.');
}

export function loginUrl(next: string): string {
  return `/prijava?next=${encodeURIComponent(next)}`;
}
