import { Alert, buttonStyles } from '@studio/ui';
import { useId, useState } from 'react';

export function ImageUpload({ imageUrl, label, onUpload, ratio = 'square' }: {
  imageUrl: string | null;
  label: string;
  onUpload: (file: File) => Promise<void>;
  ratio?: 'square' | 'wide';
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <div className={`${ratio === 'square' ? 'aspect-square max-w-48' : 'aspect-[16/10] max-w-sm'} mb-3 overflow-hidden rounded-card bg-sunken shadow-hairline`}>
        {imageUrl ? <img src={imageUrl} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center px-4 text-center text-sm text-ink-subtle">Još nema slike</div>}
      </div>
      {error ? <Alert tone="danger" className="mb-3">{error}</Alert> : null}
      <label htmlFor={id} className={buttonStyles({ variant: 'secondary', size: 'sm', className: busy ? 'pointer-events-none opacity-50' : '' })}>
        {busy ? 'Učitavanje…' : label}
      </label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={busy}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (!file) return;
          if (file.size > 5 * 1024 * 1024) { setError('Slika može imati najviše 5 MB.'); return; }
          setError(null);
          setBusy(true);
          void onUpload(file).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Upload nije uspio.')).finally(() => setBusy(false));
        }}
      />
      <p className="mt-2 text-xs text-ink-subtle">JPG, PNG ili WebP, najviše 5 MB.</p>
    </div>
  );
}
