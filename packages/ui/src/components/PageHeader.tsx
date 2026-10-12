import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export type PageHeaderProps = {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  /** Primarne akcije. Na mobitelu se slažu ispod naslova u punoj širini. */
  actions?: ReactNode;
  /** Npr. link "← Natrag" iznad naslova. */
  back?: ReactNode;
  className?: string;
};

export function PageHeader({ title, eyebrow, description, actions, back, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-8 animate-rise-in sm:mb-10', className)}>
      {back ? <div className="mb-4">{back}</div> : null}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
          <h1 className="text-[2rem] leading-[1.1] sm:text-display">{title}</h1>
          {description ? <p className="mt-3 max-w-2xl text-ink-subtle">{description}</p> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-col gap-2 *:w-full sm:flex-row sm:*:w-auto">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}

/** Naslov sekcije unutar stranice. */
export function SectionHeader({ title, description, actions, className }: Omit<PageHeaderProps, 'eyebrow' | 'back'>) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-xl">{title}</h2>
        {description ? <p className="mt-1 text-sm text-ink-subtle">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
