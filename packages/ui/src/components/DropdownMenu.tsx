import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Icon, type IconName } from '../icons/Icon';
import { cn } from '../lib/cn';

export type DropdownItem =
  | {
      type?: 'item';
      label: string;
      icon?: IconName;
      onSelect: () => void;
      tone?: 'default' | 'danger';
      disabled?: boolean;
      description?: string;
    }
  | { type: 'separator' };

export type DropdownMenuProps = {
  /** Render prop za okidač; obavezno proslijedi props na <button>. */
  trigger: (props: {
    ref: (el: HTMLButtonElement | null) => void;
    onClick: () => void;
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
    'aria-haspopup': 'menu';
    'aria-expanded': boolean;
    'aria-controls': string;
    id: string;
  }) => ReactNode;
  items: DropdownItem[];
  align?: 'start' | 'end';
  /** Otvara se prema gore (npr. korisnički izbornik na dnu sidebara). */
  placement?: 'bottom' | 'top';
  className?: string;
  menuClassName?: string;
};

/**
 * Pristupačan menu button: strelice gore/dolje, Home/End, Esc vraća fokus,
 * klik izvan zatvara. Pozicioniranje je relativno okidaču (bez portala).
 */
export function DropdownMenu({ trigger, items, align = 'end', placement = 'bottom', className, menuClassName }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const menuId = `${id}-menu`;
  const triggerId = `${id}-trigger`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusIndexOnOpen = useRef<'first' | 'last'>('first');

  const enabledIndexes = useMemo(
    () =>
      items
        .map((item, index) => (item.type !== 'separator' && !item.disabled ? index : -1))
        .filter((i) => i >= 0),
    [items],
  );

  const focusItem = (index: number | undefined) => {
    if (index === undefined) return;
    itemRefs.current[index]?.focus();
  };

  useEffect(() => {
    if (!open) return;
    focusItem(focusIndexOnOpen.current === 'first' ? enabledIndexes[0] : enabledIndexes[enabledIndexes.length - 1]);
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [enabledIndexes, open]);

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusIndexOnOpen.current = event.key === 'ArrowDown' ? 'first' : 'last';
      setOpen(true);
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = itemRefs.current.findIndex((el) => el === document.activeElement);
    const pos = enabledIndexes.indexOf(current);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusItem(enabledIndexes[(pos + 1) % enabledIndexes.length]);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusItem(enabledIndexes[(pos - 1 + enabledIndexes.length) % enabledIndexes.length]);
        break;
      case 'Home':
        event.preventDefault();
        focusItem(enabledIndexes[0]);
        break;
      case 'End':
        event.preventDefault();
        focusItem(enabledIndexes[enabledIndexes.length - 1]);
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation(); // ne zatvaraj i roditeljski drawer/modal
        close();
        break;
      case 'Tab':
        close(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className={cn('relative inline-flex', className)}>
      {trigger({
        ref: (el) => {
          triggerRef.current = el;
        },
        onClick: () => {
          focusIndexOnOpen.current = 'first';
          setOpen((o) => !o);
        },
        onKeyDown: onTriggerKeyDown,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': menuId,
        id: triggerId,
      })}
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          onKeyDown={onMenuKeyDown}
          className={cn(
            'absolute z-40 min-w-52 max-w-[calc(100vw-2rem)] rounded-control bg-raised p-1.5 shadow-overlay animate-rise-in',
            align === 'end' ? 'right-0' : 'left-0',
            placement === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2',
            menuClassName,
          )}
        >
          {items.map((item, index) =>
            item.type === 'separator' ? (
              <div key={`sep-${index}`} role="separator" className="my-1.5 h-px bg-line" />
            ) : (
              <button
                key={item.label}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
                className={cn(
                  'flex w-full items-start gap-3 rounded-[0.5rem] px-3 py-2.5 text-left text-sm outline-none transition-colors',
                  'hover:bg-sunken/70 focus-visible:bg-sunken/70 focus-visible:outline-none disabled:opacity-50',
                  item.tone === 'danger' ? 'text-danger' : 'text-ink',
                )}
              >
                {item.icon ? <Icon name={item.icon} size={18} className="mt-px shrink-0 opacity-80" /> : null}
                <span className="min-w-0">
                  <span className="block">{item.label}</span>
                  {item.description ? <span className="block text-xs text-ink-subtle">{item.description}</span> : null}
                </span>
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
