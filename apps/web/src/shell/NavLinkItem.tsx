import { NavLink } from 'react-router';
import { cn, Icon } from '@studio/ui';
import { joinPath, type NavItem } from './nav';

/** Stavka u sidebaru i draweru. */
export function NavLinkItem({ item, base, onNavigate }: { item: NavItem; base: string; onNavigate?: () => void }) {
  return (
    <NavLink
      to={joinPath(base, item.path)}
      end={item.path === ''}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group relative flex h-10 items-center gap-3 rounded-control px-3 text-sm transition-[background-color,color,box-shadow] duration-200 ease-soft',
          isActive ? 'bg-raised font-medium text-ink shadow-soft' : 'text-ink-muted hover:bg-sunken/60 hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            name={item.icon}
            size={19}
            className={cn('shrink-0 transition-colors', isActive ? 'text-accent' : 'text-ink-subtle group-hover:text-ink-muted')}
          />
          <span className="truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

export function NavSections({
  sections,
  base,
  onNavigate,
  label,
}: {
  sections: { id: string; label: string; items: NavItem[] }[];
  base: string;
  onNavigate?: () => void;
  label: string;
}) {
  return (
    <nav aria-label={label} className="space-y-6">
      {sections.map((section) => (
        <div key={section.id}>
          <p className="eyebrow mb-2 px-3">{section.label}</p>
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.id}>
                <NavLinkItem item={item} base={base} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
