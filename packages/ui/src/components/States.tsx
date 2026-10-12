import type { ReactNode } from 'react';
import { Icon, type IconName } from '../icons/Icon';
import { cn } from '../lib/cn';
import { Button } from './Button';
import { SkeletonRows } from './Skeleton';
import { Spinner } from './Spinner';

type StateLayoutProps = {
  icon?: IconName;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  /** `compact` za prazna stanja unutar kartice. */
  size?: 'page' | 'compact';
  tone?: 'neutral' | 'danger';
};

function StateLayout({ icon, title, description, action, className, size = 'page', tone = 'neutral' }: StateLayoutProps) {
  return (
    <div
      className={cn(
        'mx-auto flex max-w-md flex-col items-center text-center animate-rise-in',
        size === 'page' ? 'px-4 py-16 sm:py-20' : 'px-2 py-10',
        className,
      )}
    >
      {icon ? (
        <span
          className={cn(
            'mb-5 grid size-14 place-items-center rounded-full ring-1 ring-inset',
            tone === 'danger' ? 'bg-danger-soft text-danger ring-danger/15' : 'bg-surface text-taupe ring-line',
          )}
        >
          <Icon name={icon} size={24} strokeWidth={1.25} />
        </span>
      ) : null}
      <h2 className={cn(size === 'page' ? 'text-2xl' : 'text-lg')}>{title}</h2>
      {description ? <p className="mt-2 text-sm text-ink-subtle">{description}</p> : null}
      {action ? <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export type EmptyStateProps = Omit<StateLayoutProps, 'tone'>;

export function EmptyState({ icon = 'inbox', ...rest }: EmptyStateProps) {
  return <StateLayout icon={icon} {...rest} />;
}

export type ErrorStateProps = Omit<StateLayoutProps, 'tone' | 'title'> & {
  title?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
};

export function ErrorState({
  title = 'Nešto je pošlo po krivu',
  description = 'Podatke trenutno nije moguće učitati. Pokušajte ponovno za nekoliko trenutaka.',
  onRetry,
  retryLabel = 'Pokušaj ponovno',
  action,
  icon = 'alert',
  ...rest
}: ErrorStateProps) {
  return (
    <div role="alert">
      <StateLayout
        tone="danger"
        icon={icon}
        title={title}
        description={description}
        action={
          action ??
          (onRetry ? (
            <Button variant="secondary" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : undefined)
        }
        {...rest}
      />
    </div>
  );
}

export type LoadingStateProps = { label?: string; variant?: 'spinner' | 'rows'; rows?: number; className?: string };

export function LoadingState({ label = 'Učitavanje', variant = 'spinner', rows, className }: LoadingStateProps) {
  if (variant === 'rows') {
    return (
      <div role="status" aria-live="polite" className={className}>
        <span className="sr-only">{label}</span>
        <SkeletonRows rows={rows} />
      </div>
    );
  }
  return (
    <div role="status" aria-live="polite" className={cn('flex items-center justify-center gap-3 py-16 text-sm text-ink-subtle', className)}>
      <Spinner size={18} />
      <span>{label}…</span>
    </div>
  );
}

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export type AsyncStateProps<T> = {
  status: AsyncStatus;
  data: T | undefined;
  error?: unknown;
  /** Vraća true kad podaci postoje, ali su prazni (npr. prazna lista). */
  isEmpty?: (data: T) => boolean;
  loading?: ReactNode;
  empty?: ReactNode;
  renderError?: (error: unknown) => ReactNode;
  onRetry?: () => void;
  children: (data: T) => ReactNode;
};

/**
 * Jedinstveno mjesto za loading / error / empty / success grananje.
 * Svaki async ekran ide kroz ovo da nijedno stanje ne bude zaboravljeno.
 */
export function AsyncState<T>({ status, data, error, isEmpty, loading, empty, renderError, onRetry, children }: AsyncStateProps<T>) {
  if (status === 'error') return <>{renderError ? renderError(error) : <ErrorState onRetry={onRetry} />}</>;
  if (status === 'loading' || status === 'idle' || data === undefined) return <>{loading ?? <LoadingState />}</>;
  if (isEmpty?.(data)) return <>{empty ?? <EmptyState title="Još nema ničega" />}</>;
  return <>{children(data)}</>;
}
