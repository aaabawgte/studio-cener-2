import { useCallback, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

export type FieldErrors<V> = Partial<Record<keyof V & string, string>>;

/** Oblik greške koji forma zna prikazati. API klijent treba bacati nešto kompatibilno. */
export type SubmitErrorShape<V> = {
  message?: string;
  fieldErrors?: FieldErrors<V>;
};

function isSubmitErrorShape<V>(value: unknown): value is SubmitErrorShape<V> {
  return typeof value === 'object' && value !== null && ('message' in value || 'fieldErrors' in value);
}

export type UseFormOptions<V extends Record<string, unknown>> = {
  initialValues: V;
  /** Sinkrona client-side validacija. Vrati prazan objekt kad je sve u redu. (Lako se spaja sa Zod `safeParse`.) */
  validate?: (values: V) => FieldErrors<V>;
  onSubmit: (values: V) => Promise<void> | void;
  /** Poruka kad server vrati grešku bez teksta. */
  fallbackErrorMessage?: string;
};

export function useForm<V extends Record<string, unknown>>({
  initialValues,
  validate,
  onSubmit,
  fallbackErrorMessage = 'Spremanje nije uspjelo. Pokušajte ponovno.',
}: UseFormOptions<V>) {
  const [values, setValues] = useState<V>(initialValues);
  const [errors, setErrors] = useState<FieldErrors<V>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof V & string, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const initialRef = useRef(initialValues);

  const runValidation = useCallback((next: V): FieldErrors<V> => (validate ? validate(next) : {}), [validate]);

  const valuesRef = useRef(values);
  valuesRef.current = values;

  const setValue = useCallback(
    <K extends keyof V & string>(name: K, value: V[K]) => {
      const next = { ...valuesRef.current, [name]: value };
      valuesRef.current = next;
      setValues(next);
      // Nakon prvog pokušaja slanja greške se osvježavaju dok korisnik tipka;
      // prije toga se samo briše greška polja koje se ispravlja.
      if (submitted) setErrors(runValidation(next));
      else setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e));
    },
    [runValidation, submitted],
  );

  /** Spoji na Input/Textarea/Select: `<Input {...register('email')} />`. */
  const register = <K extends keyof V & string>(name: K) => ({
    name,
    value: (values[name] ?? '') as string,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setValue(name, event.target.value as V[K]),
    onBlur: () => {
      setTouched((t) => ({ ...t, [name]: true }));
      const fieldError = runValidation(valuesRef.current)[name];
      setErrors((e) => ({ ...e, [name]: fieldError }));
    },
  });

  /** Greška za prikaz u <Field error={…}> — samo nakon blur-a ili pokušaja slanja. */
  const errorFor = (name: keyof V & string): string | undefined => (touched[name] || submitted ? errors[name] : undefined);

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (submitting) return;
    setSubmitted(true);
    setFormError(null);
    const nextErrors = runValidation(values);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      // Fokus na prvo neispravno polje.
      requestAnimationFrame(() => {
        const first = document.querySelector<HTMLElement>('[aria-invalid="true"]');
        first?.focus();
      });
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (error: unknown) {
      if (isSubmitErrorShape<V>(error)) {
        if (error.fieldErrors) setErrors(error.fieldErrors);
        setFormError(error.message ?? fallbackErrorMessage);
      } else {
        setFormError(fallbackErrorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const reset = (next: V = initialRef.current) => {
    setValues(next);
    setErrors({});
    setTouched({});
    setSubmitted(false);
    setFormError(null);
  };

  return { values, errors, setValue, register, errorFor, handleSubmit, submitting, formError, setFormError, reset };
}
