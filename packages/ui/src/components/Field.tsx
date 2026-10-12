import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Icon } from '../icons/Icon';
import { cn } from '../lib/cn';

type FieldContextValue = {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
};

const FieldContext = createContext<FieldContextValue | null>(null);

export type FieldProps = {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  /** Poruka greške (client ili server). Kad postoji, kontrola dobiva aria-invalid. */
  error?: string | null;
  required?: boolean;
  /** Vizualno sakrij label (ostaje za čitače ekrana). */
  hideLabel?: boolean;
  /** Desni dio labela, npr. "Opcionalno" ili brojač znakova. */
  aside?: ReactNode;
  id?: string;
  className?: string;
};

/**
 * Povezuje label, hint i grešku s kontrolom (Input/Textarea/Select) preko konteksta:
 * kontrola automatski dobiva id, aria-describedby, aria-invalid i required.
 */
export function Field({ label, children, hint, error, required = false, hideLabel, aside, id, className }: FieldProps) {
  const autoId = useId();
  const controlId = id ?? `f${autoId}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <FieldContext.Provider value={{ id: controlId, describedBy, invalid: Boolean(error), required }}>
      <div className={cn('min-w-0', className)}>
        <div className={cn('mb-1.5 flex items-baseline justify-between gap-3', hideLabel && 'sr-only')}>
          <label htmlFor={controlId} className="text-sm font-medium text-ink">
            {label}
            {required ? (
              <span aria-hidden="true" className="ml-0.5 text-accent">
                *
              </span>
            ) : null}
          </label>
          {aside ? <span className="text-xs text-ink-subtle">{aside}</span> : null}
        </div>
        {children}
        {error ? (
          <p id={errorId} className="mt-1.5 flex items-start gap-1.5 text-[0.8125rem] text-danger animate-fade-in">
            <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}
        {hint ? (
          <p id={hintId} className="mt-1.5 text-[0.8125rem] text-ink-subtle">
            {hint}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

function useFieldControl<T extends { id?: string; required?: boolean; 'aria-describedby'?: string; 'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling' }>(props: T) {
  const ctx = useContext(FieldContext);
  if (!ctx) return props;
  return {
    ...props,
    id: props.id ?? ctx.id,
    required: props.required ?? ctx.required,
    'aria-describedby': [props['aria-describedby'], ctx.describedBy].filter(Boolean).join(' ') || undefined,
    'aria-invalid': props['aria-invalid'] ?? (ctx.invalid || undefined),
  };
}

export const controlStyles =
  'block w-full min-w-0 rounded-control bg-raised text-ink shadow-hairline placeholder:text-ink-subtle/70 ' +
  'transition-[box-shadow,background-color] duration-200 ease-soft ' +
  'hover:shadow-[0_0_0_1px_var(--color-line-strong)] ' +
  'focus:outline-none focus-visible:outline-none focus:shadow-[0_0_0_1px_var(--color-accent),0_0_0_4px_var(--color-accent-soft)] ' +
  'aria-invalid:shadow-[0_0_0_1px_var(--color-danger)] aria-invalid:focus:shadow-[0_0_0_1px_var(--color-danger),0_0_0_4px_var(--color-danger-soft)] ' +
  'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-subtle';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  leading?: ReactNode;
  trailing?: ReactNode;
};

/** Visina 44px (dodirna meta), 16px font na mobitelu da iOS ne zumira. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, leading, trailing, ...rest }, ref) {
  const props = useFieldControl(rest);
  const input = (
    <input
      ref={ref}
      className={cn(controlStyles, 'h-11 px-3.5 text-base sm:text-sm', leading && 'pl-10', trailing && 'pr-10', className)}
      {...props}
    />
  );
  if (!leading && !trailing) return input;
  return (
    <div className="relative">
      {leading ? (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-subtle">{leading}</span>
      ) : null}
      {input}
      {trailing ? <span className="absolute inset-y-0 right-3 flex items-center text-ink-subtle">{trailing}</span> : null}
    </div>
  );
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, rows = 4, ...rest }, ref) {
  const props = useFieldControl(rest);
  return <textarea ref={ref} rows={rows} className={cn(controlStyles, 'resize-y px-3.5 py-3 text-base sm:text-sm', className)} {...props} />;
});

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { placeholder?: string };

/** Nativni select — najbolji UX na mobitelu i potpuno dostupan. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, children, placeholder, ...rest }, ref) {
  const props = useFieldControl(rest);
  return (
    <div className="relative">
      <select ref={ref} className={cn(controlStyles, 'h-11 appearance-none pr-10 pl-3.5 text-base sm:text-sm', className)} {...props}>
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {children}
      </select>
      <Icon name="chevronDown" size={18} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-subtle" />
    </div>
  );
});

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: ReactNode;
  description?: ReactNode;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ label, description, className, id, ...rest }, ref) {
  const autoId = useId();
  const inputId = id ?? `c${autoId}`;
  const descId = description ? `${inputId}-desc` : undefined;
  return (
    <div className={cn('flex gap-3', className)}>
      <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          aria-describedby={descId}
          className="peer size-5 cursor-pointer appearance-none rounded-[0.375rem] bg-raised shadow-[0_0_0_1px_var(--color-line-strong)] transition-colors checked:bg-ink checked:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
          {...rest}
        />
        <Icon name="check" size={14} strokeWidth={2.25} className="pointer-events-none absolute text-ink-inverse opacity-0 peer-checked:opacity-100" />
      </span>
      <span className="min-w-0">
        <label htmlFor={inputId} className="cursor-pointer text-sm font-medium">
          {label}
        </label>
        {description ? (
          <span id={descId} className="block text-[0.8125rem] text-ink-subtle">
            {description}
          </span>
        ) : null}
      </span>
    </div>
  );
});
