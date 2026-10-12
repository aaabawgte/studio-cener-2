import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from '../icons/Icon';
import { cn } from '../lib/cn';

export type ToastTone = 'neutral' | 'success' | 'danger' | 'info';

export type ToastOptions = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** ms; 0 = ostaje dok se ne zatvori. Zadano 5000 (greške 8000). */
  duration?: number;
  action?: { label: string; onClick: () => void };
};

type ToastRecord = ToastOptions & { id: number; leaving: boolean };

type ToastApi = {
  show: (options: ToastOptions) => number;
  success: (title: string, description?: string) => number;
  error: (title: string, description?: string) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const toneIcon: Record<ToastTone, IconName | null> = {
  neutral: null,
  success: 'success',
  danger: 'alert',
  info: 'info',
};

const toneIconColor: Record<ToastTone, string> = {
  neutral: '',
  success: 'text-success',
  danger: 'text-danger',
  info: 'text-info',
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timers = useRef(new Map<number, number>());

  const remove = useCallback((id: number) => {
    setToasts((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 200);
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      const id = nextId++;
      const tone = options.tone ?? 'neutral';
      setToasts((list) => [...list.slice(-3), { ...options, tone, id, leaving: false }]);
      const duration = options.duration ?? (tone === 'danger' ? 8000 : 5000);
      if (duration > 0) timers.current.set(id, window.setTimeout(() => remove(id), duration));
      return id;
    },
    [remove],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => window.clearTimeout(t));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, description) => show({ title, description, tone: 'success' }),
      error: (title, description) => show({ title, description, tone: 'danger' }),
      dismiss: remove,
    }),
    [show, remove],
  );

  const polite = toasts.filter((t) => t.tone !== 'danger');
  const assertive = toasts.filter((t) => t.tone === 'danger');

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Mobitel: ispod top bara; desktop: dolje desno. Dvije live regije: polite i assertive. */}
      <div
        className={cn(
          'pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+var(--shell-topbar-h)+0.5rem)] z-[60] flex flex-col items-center gap-2 px-4',
          'lg:inset-x-auto lg:top-auto lg:right-6 lg:bottom-6 lg:items-end lg:px-0',
        )}
      >
        <div role="status" aria-live="polite" className="flex w-full flex-col items-center gap-2 lg:items-end">
          {polite.map((t) => (
            <ToastView key={t.id} toast={t} onDismiss={() => remove(t.id)} />
          ))}
        </div>
        <div role="alert" aria-live="assertive" className="flex w-full flex-col items-center gap-2 lg:items-end">
          {assertive.map((t) => (
            <ToastView key={t.id} toast={t} onDismiss={() => remove(t.id)} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: ToastRecord; onDismiss: () => void }) {
  const tone = toast.tone ?? 'neutral';
  const icon = toneIcon[tone];
  return (
    <div
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card bg-ink px-4 py-3.5 text-ink-inverse shadow-overlay',
        'transition-[opacity,transform] duration-200 ease-soft',
        toast.leaving ? 'translate-y-1 opacity-0' : 'animate-rise-in',
      )}
    >
      {icon ? (
        <span className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-ink-inverse">
          <Icon name={icon} size={16} className={toneIconColor[tone]} strokeWidth={1.75} />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.description ? <p className="mt-0.5 text-[0.8125rem] text-ink-inverse/70">{toast.description}</p> : null}
      </div>
      {toast.action ? (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            onDismiss();
          }}
          className="shrink-0 rounded-md px-1.5 text-sm font-medium text-ink-inverse underline decoration-ink-inverse/40 underline-offset-4 hover:decoration-ink-inverse"
        >
          {toast.action.label}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Zatvori obavijest"
        className="-mr-1 grid size-6 shrink-0 place-items-center rounded-full text-ink-inverse/60 hover:text-ink-inverse"
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast mora biti unutar <ToastProvider>.');
  return ctx;
}
