import { API_BASE_URL } from '../env';

export type ApiErrorBody = {
  code?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * Greška API poziva. Oblik (`message`, `fieldErrors`) je kompatibilan s `useForm`
 * iz @studio/ui, pa forme automatski prikazuju server greške po polju.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly fieldErrors: Record<string, string> | undefined;

  constructor(status: number, body: ApiErrorBody = {}) {
    super(body.message ?? defaultMessage(status));
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.fieldErrors = body.fieldErrors;
  }
}

function defaultMessage(status: number): string {
  if (status === 0) return 'Nema veze s poslužiteljem. Provjerite internet i pokušajte ponovno.';
  if (status === 401) return 'Sesija je istekla. Prijavite se ponovno.';
  if (status === 403) return 'Nemate ovlasti za ovu radnju.';
  if (status === 404) return 'Traženi sadržaj ne postoji.';
  if (status === 409) return 'Podaci su se u međuvremenu promijenili. Osvježite i pokušajte ponovno.';
  if (status === 429) return 'Previše zahtjeva. Pričekajte trenutak.';
  return 'Došlo je do pogreške. Pokušajte ponovno.';
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null;
}

export type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  /** Za mutacije: ključ idempotentnosti (backend ga zahtijeva za booking/financije). */
  idempotencyKey?: string;
};

export async function apiFetch<T>(path: string, { body, idempotencyKey, headers, ...init }: ApiRequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0);
  }

  if (response.status === 204) return undefined as T;

  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw new ApiError(response.status, isErrorBody(payload) ? payload : {});
  return payload as T;
}
