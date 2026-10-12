import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'quiet' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-soft ' +
  'active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-ink-inverse shadow-soft hover:bg-ink/88',
  secondary: 'bg-raised text-ink shadow-hairline hover:bg-surface hover:shadow-soft',
  ghost: 'text-ink-muted hover:bg-sunken/70 hover:text-ink',
  quiet: 'bg-accent-soft text-accent-strong hover:bg-accent-soft/70',
  danger: 'bg-danger text-white shadow-soft hover:bg-danger/90',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-[0.8125rem]',
  md: 'h-11 px-4.5 text-sm',
  lg: 'h-12 px-6 text-[0.9375rem]',
};

export type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
};

/** Iste klase za <a>/<Link> koji vizualno trebaju biti gumb. */
export function buttonStyles({ variant = 'primary', size = 'md', fullWidth, className }: ButtonStyleOptions = {}) {
  return cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className);
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  Omit<ButtonStyleOptions, 'className'> & {
    loading?: boolean;
    /** Tekst za čitače ekrana dok traje loading (zadano: "Učitavanje"). */
    loadingLabel?: string;
    leadingIcon?: ReactNode;
    trailingIcon?: ReactNode;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant,
    size,
    fullWidth,
    loading = false,
    loadingLabel = 'Učitavanje',
    leadingIcon,
    trailingIcon,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonStyles({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading ? (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner label={loadingLabel} />
        </span>
      ) : null}
      <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>
        {leadingIcon}
        {children}
        {trailingIcon}
      </span>
    </button>
  );
});

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & {
  /** Obavezno: gumb bez teksta mora imati dostupno ime. */
  label: string;
  variant?: Extract<ButtonVariant, 'ghost' | 'secondary' | 'quiet'>;
  size?: 'sm' | 'md';
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'ghost', size = 'md', className, type = 'button', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        base,
        variants[variant],
        size === 'sm' ? 'size-9' : 'size-11',
        'rounded-full p-0',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
