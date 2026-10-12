import { useCallback, useEffect, useRef, useState } from 'react';
import type { AsyncStatus } from '@studio/ui';

export type AsyncResult<T> = {
  status: AsyncStatus;
  data: T | undefined;
  error: unknown;
  reload: () => void;
};

/**
 * Minimalni loader s abortom i reloadom. Kad broj ekrana naraste, zamijeniti
 * s TanStack Query (cache, revalidacija) — API ovog hooka je namjerno sličan.
 */
export function useAsync<T>(load: (signal: AbortSignal) => Promise<T>, deps: readonly unknown[]): AsyncResult<T> {
  const [state, setState] = useState<{ status: AsyncStatus; data: T | undefined; error: unknown }>({
    status: 'loading',
    data: undefined,
    error: undefined,
  });
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ status: 'loading', data: s.data, error: undefined }));
    loadRef
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ status: 'success', data, error: undefined });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', data: undefined, error });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps prosljeđuje pozivatelj
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
