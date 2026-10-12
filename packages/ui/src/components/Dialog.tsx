import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { usePresence } from '../hooks/usePresence';
import { useScrollLock } from '../hooks/useScrollLock';
import { Icon } from '../icons/Icon';
import { cn } from '../lib/cn';
import { Button, IconButton } from './Button';

type OverlayProps = {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  /** false = klik na pozadinu ne zatvara (npr. forma s nespremljenim promjenama). */
  dismissible?: boolean;
  initialFocus?: RefObject<HTMLElement | null>;
  containerClassName: string;
  panelClassName: (visible: boolean) => string;
  children: ReactNode;
  role?: 'dialog' | 'alertdialog';
};

/** Zajednička osnova za Modal i Drawer: portal, scrim, Esc, focus trap, scroll lock, animacija. */
function Overlay({
  open,
  onClose,
  labelledBy,
  describedBy,
  dismissible = true,
  initialFocus,
  containerClassName,
  panelClassName,
  children,
  role = 'dialog',
}: OverlayProps) {
  const { mounted, visible } = usePresence(open, 240);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useScrollLock(mounted);
  useFocusTrap(panelRef, open && mounted, initialFocus);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) {
        event.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, dismissible]);

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div className={cn('fixed inset-0 z-50', containerClassName)}>
      <div
        aria-hidden="true"
        onClick={dismissible ? onClose : undefined}
        className={cn(
          'absolute inset-0 bg-scrim backdrop-blur-[2px] transition-opacity duration-300 ease-soft',
          visible ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={cn('relative flex flex-col bg-raised shadow-overlay outline-none', panelClassName(visible))}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Akcije u dnu. Na mobitelu se slažu okomito, primarna gore. */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  dismissible?: boolean;
  initialFocus?: RefObject<HTMLElement | null>;
  role?: 'dialog' | 'alertdialog';
};

const modalSizes = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' } as const;

/**
 * Na < 640px prikazuje se kao bottom sheet (pun width, max 92dvh, sadržaj scrolla
 * unutar), na većim ekranima kao centrirani dijalog.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', dismissible = true, initialFocus, role }: ModalProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = description ? `${id}-desc` : undefined;

  return (
    <Overlay
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      describedBy={descId}
      dismissible={dismissible}
      initialFocus={initialFocus}
      role={role}
      containerClassName="flex items-end justify-center sm:items-center sm:p-6"
      panelClassName={(visible) =>
        cn(
          'max-h-[92dvh] w-full rounded-t-sheet sm:rounded-sheet',
          modalSizes[size],
          'transition-[opacity,transform] duration-300 ease-soft',
          visible ? 'translate-y-0 opacity-100 sm:scale-100' : 'translate-y-6 opacity-0 sm:translate-y-2 sm:scale-[0.98]',
        )
      }
    >
      <div aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line-strong sm:hidden" />
      <div className="flex items-start gap-4 px-5 pt-4 pb-2 sm:px-7 sm:pt-7">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-xl leading-snug sm:text-2xl">
            {title}
          </h2>
          {description ? (
            <p id={descId} className="mt-1.5 text-sm text-ink-subtle">
              {description}
            </p>
          ) : null}
        </div>
        {dismissible ? (
          <IconButton label="Zatvori" size="sm" onClick={onClose} className="-mt-1 -mr-2">
            <Icon name="close" size={18} />
          </IconButton>
        ) : null}
      </div>
      {children ? <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3 sm:px-7">{children}</div> : null}
      {footer ? (
        <div className="flex flex-col-reverse gap-2 border-t border-line px-5 pt-4 pb-[calc(1rem+var(--safe-bottom))] sm:flex-row sm:justify-end sm:px-7 sm:pb-5 [&>*]:w-full sm:[&>*]:w-auto">
          {footer}
        </div>
      ) : (
        <div className="h-[calc(1.25rem+var(--safe-bottom))] sm:h-6" />
      )}
    </Overlay>
  );
}

export type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  loading?: boolean;
};

/** Potvrda destruktivne/nepovratne akcije. Fokus ide na "Odustani". */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Potvrdi',
  cancelLabel = 'Odustani',
  tone = 'default',
  loading = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      role="alertdialog"
      dismissible={!loading}
      initialFocus={cancelRef}
      footer={
        <>
          <Button ref={cancelRef} variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Vizualno sakrij naslov (npr. kad drawer ima vlastiti brand header). */
  hideTitle?: boolean;
  side?: 'left' | 'right';
  children: ReactNode;
  footer?: ReactNode;
  header?: ReactNode;
};

export function Drawer({ open, onClose, title, hideTitle, side = 'left', children, footer, header }: DrawerProps) {
  const id = useId();
  const titleId = `${id}-title`;
  return (
    <Overlay
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      containerClassName={cn('flex', side === 'right' && 'justify-end')}
      panelClassName={(visible) =>
        cn(
          'h-full w-[min(20rem,86vw)] pt-[var(--safe-top)] transition-transform duration-300 ease-soft',
          side === 'left' ? 'rounded-r-sheet' : 'rounded-l-sheet',
          visible ? 'translate-x-0' : side === 'left' ? '-translate-x-full' : 'translate-x-full',
        )
      }
    >
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className={cn('text-lg', hideTitle && 'sr-only')}>
            {title}
          </h2>
          {header}
        </div>
        <IconButton label="Zatvori izbornik" size="sm" onClick={onClose}>
          <Icon name="close" size={18} />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">{children}</div>
      {footer ? <div className="border-t border-line px-3 pt-3 pb-[calc(0.75rem+var(--safe-bottom))]">{footer}</div> : null}
    </Overlay>
  );
}
