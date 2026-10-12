import { cn } from '../lib/cn';

export type SpinnerProps = { size?: number; className?: string; label?: string };

/** Tanki prsten koji se vrti. S `label` je dostupan čitačima ekrana. */
export function Spinner({ size = 16, className, label }: SpinnerProps) {
  return (
    <span role={label ? 'status' : undefined} className={cn('inline-flex shrink-0', className)}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="animate-spin">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
        <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
