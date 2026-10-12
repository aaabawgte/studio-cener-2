import type { ReactNode } from 'react';
import { Icon } from '../icons/Icon';
import { cn } from '../lib/cn';
import { LoadingState } from './States';

export type DataColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Glavni stupac: naslov kartice na mobitelu i nositelj klikabilnog retka. Točno jedan. */
  primary?: boolean;
  /** Ne prikazuj u mobilnoj kartici (desktop tablica ga i dalje ima). */
  hideOnMobile?: boolean;
  align?: 'start' | 'end';
  className?: string;
};

export type DataListProps<T> = {
  /** Kratak opis tablice za čitače ekrana. */
  caption: string;
  columns: DataColumn<T>[];
  rows: T[] | undefined;
  getRowKey: (row: T) => string;
  /** Klik na redak (npr. otvori detalje). Dostupno tipkovnicom preko primarnog stupca. */
  onRowClick?: (row: T) => void;
  /** Dostupno ime akcije retka, npr. (r) => `Otvori termin ${r.title}`. */
  rowActionLabel?: (row: T) => string;
  loading?: boolean;
  empty?: ReactNode;
  className?: string;
};

/**
 * Responzivni prikaz kolekcije: tablica od `md` naviše, kartice ispod.
 * Nikad ne uzrokuje horizontalni scroll stranice.
 */
export function DataList<T>({
  caption,
  columns,
  rows,
  getRowKey,
  onRowClick,
  rowActionLabel,
  loading = false,
  empty,
  className,
}: DataListProps<T>) {
  if (loading || rows === undefined) return <LoadingState variant="rows" rows={4} className={className} />;
  if (rows.length === 0) return <>{empty ?? null}</>;

  const primary = columns.find((c) => c.primary) ?? columns[0];
  const secondary = columns.filter((c) => c !== primary && !c.hideOnMobile);

  const primaryContent = (row: T) => {
    const content = primary?.cell(row);
    if (!onRowClick) return content;
    return (
      <button
        type="button"
        onClick={() => onRowClick(row)}
        aria-label={rowActionLabel?.(row)}
        className="text-left font-medium text-ink outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px] focus-visible:after:outline-accent"
      >
        {content}
      </button>
    );
  };

  return (
    <div className={cn('min-w-0', className)}>
      {/* Desktop / tablet */}
      <div className="hidden overflow-hidden rounded-card bg-raised shadow-soft md:block">
        <table className="w-full table-fixed border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line">
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className={cn(
                    'eyebrow px-5 py-3.5 font-medium',
                    col.align === 'end' ? 'text-right' : 'text-left',
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
              {onRowClick ? <th aria-hidden="true" className="w-10" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={getRowKey(row)}
                className={cn(
                  'relative border-b border-line/70 last:border-0',
                  onRowClick && 'cursor-pointer transition-colors hover:bg-surface',
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className={cn(
                      'truncate px-5 py-4 align-middle',
                      col === primary ? 'text-ink' : 'text-ink-muted',
                      col.align === 'end' && 'text-right tabular',
                      col.className,
                    )}
                  >
                    {col === primary ? primaryContent(row) : col.cell(row)}
                  </td>
                ))}
                {onRowClick ? (
                  <td aria-hidden="true" className="pr-4 text-ink-subtle">
                    <Icon name="chevronRight" size={18} />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobitel */}
      <ul aria-label={caption} className="space-y-2.5 md:hidden">
        {rows.map((row) => (
          <li
            key={getRowKey(row)}
            className={cn(
              'relative rounded-card bg-raised p-4 shadow-soft',
              onRowClick && 'transition-transform active:scale-[0.99]',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 text-[0.9375rem]">{primaryContent(row)}</div>
              {onRowClick ? <Icon name="chevronRight" size={18} className="mt-0.5 shrink-0 text-ink-subtle" /> : null}
            </div>
            {secondary.length > 0 ? (
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[0.8125rem]">
                {secondary.map((col) => (
                  <div key={col.id} className="min-w-0">
                    <dt className="text-ink-subtle">{col.header}</dt>
                    <dd className="truncate text-ink">{col.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
