import { cn } from '../lib/cn';

export type AvatarProps = { name: string; src?: string | null; size?: 'sm' | 'md' | 'lg'; className?: string };

const sizes = { sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-14 text-base' } as const;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '·';
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-accent-soft font-medium text-accent-strong',
        sizes[size],
        className,
      )}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : <span aria-hidden="true">{initials(name)}</span>}
      <span className="sr-only">{name}</span>
    </span>
  );
}
