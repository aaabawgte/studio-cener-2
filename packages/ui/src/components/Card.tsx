import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** `flat` za ugniježđene kartice ili sekcije bez sjene. */
  variant?: 'raised' | 'flat' | 'outline';
  padded?: boolean;
};

const variants = {
  raised: 'bg-raised shadow-soft',
  flat: 'bg-surface',
  outline: 'bg-transparent ring-1 ring-line ring-inset',
} as const;

export function Card({ variant = 'raised', padded = true, className, ...rest }: CardProps) {
  return <div className={cn('rounded-card min-w-0', variants[variant], padded && 'p-5 sm:p-6', className)} {...rest} />;
}

export type CardHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
  /** Razina naslova unutar stranice (zadano h2). */
  as?: 'h2' | 'h3';
};

export function CardHeader({ title, description, actions, eyebrow, className, as: Heading = 'h2' }: CardHeaderProps) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2', className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <Heading className="text-lg leading-snug">{title}</Heading>
        {description ? <p className="mt-1 text-sm text-ink-subtle">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('-mx-5 -mb-5 mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4 sm:-mx-6 sm:-mb-6 sm:px-6', className)}
      {...rest}
    />
  );
}

/** Mali KPI blok za dashboarde. */
export function Stat({ label, value, hint, className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="eyebrow">{label}</p>
      <p className="mt-2 font-display text-3xl leading-none font-[360] tabular">{value}</p>
      {hint ? <p className="mt-2 text-xs text-ink-subtle">{hint}</p> : null}
    </div>
  );
}
