import { NavLink } from 'react-router';
import { cn, Icon } from '@studio/ui';
import { joinPath, type NavItem } from './nav';

/**
 * Stabilan bottom nav (mobitel i tablet, < lg). Uvijek iste stavke istim redom;
 * sve ostalo je u draweru. Poštuje safe-area na iPhoneu.
 */
export function BottomNav({ items, base, label }: { items: NavItem[]; base: string; label: string }) {
  const visible = items.slice(0, 4);
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/92 pb-safe backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid h-[var(--shell-bottomnav-h)] max-w-xl" style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}>
        {visible.map((item) => (
          <li key={item.id} className="min-w-0">
            <NavLink
              to={joinPath(base, item.path)}
              end={item.path === ''}
              className={({ isActive }) =>
                cn(
                  'flex h-full flex-col items-center justify-center gap-1 px-1 text-[0.6875rem] leading-none transition-colors duration-200',
                  isActive ? 'font-medium text-ink' : 'text-ink-subtle hover:text-ink-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'grid h-7 w-12 place-items-center rounded-full transition-[background-color,color] duration-300 ease-soft',
                      isActive ? 'bg-accent-soft text-accent-strong' : '',
                    )}
                  >
                    <Icon name={item.icon} size={21} strokeWidth={isActive ? 1.75 : 1.5} />
                  </span>
                  <span className="max-w-full truncate">{item.shortLabel ?? item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
