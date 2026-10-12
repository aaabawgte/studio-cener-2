import type { ReactNode } from 'react';
import { Icon, type IconName } from '../icons/Icon';
import { cn } from '../lib/cn';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const toneStyles: Record<AlertTone, { box: string; icon: IconName }> = {
  info: { box: 'bg-info-soft text-info', icon: 'info' },
  success: { box: 'bg-success-soft text-success', icon: 'success' },
  warning: { box: 'bg-warning-soft text-warning', icon: 'alert' },
  danger: { box: 'bg-danger-soft text-danger', icon: 'alert' },
};

export type AlertProps = {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
};

/** Inline poruka (npr. server greška iznad forme). Danger je `role="alert"`. */
export function Alert({ tone = 'info', title, children, action, className }: AlertProps) {
  const t = toneStyles[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-control px-4 py-3 text-sm animate-fade-in', t.box, className)}
    >
      <Icon name={t.icon} size={18} className="mt-px shrink-0" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn('text-ink-muted', title && 'mt-0.5')}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}
