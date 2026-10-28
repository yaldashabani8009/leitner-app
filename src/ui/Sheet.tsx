import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './Sheet.module.css';

interface SheetProps {
  open: boolean;
  /** Called on Esc, a tap on the dim overlay, or the handle. The parent sets open to false. */
  onClose: () => void;
  /** Shown as the heading and read out when the sheet opens. */
  title: string;
  /** "bottom": add / edit sheet sliding up. "dialog": centred card (duplicate word). */
  variant?: 'bottom' | 'dialog';
  /** Decorative mascot: peeks over the bottom sheet, or sits in a circle on top of the dialog. */
  mascot?: ReactNode;
  /** Stays pinned at the bottom of the bottom sheet while the rest scrolls (e.g. Save word). */
  footer?: ReactNode;
  /** Element to focus when the sheet opens; by default the sheet itself, so its title is read. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  children?: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal sheet built by hand (decided in 7.7). While open:
 * - everything else on the page is `inert` (no taps, no focus, hidden from screen readers);
 * - Tab and Shift+Tab cycle inside the sheet; Esc closes it;
 * - the page behind doesn't scroll;
 * - on close, focus goes back to whatever opened it.
 */
export function Sheet({
  open,
  onClose,
  title,
  variant = 'bottom',
  mascot,
  footer,
  initialFocusRef,
  children,
}: SheetProps) {
  const titleId = useId();
  const layerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useModalBehaviour(open, layerRef, panelRef, initialFocusRef);

  if (!open) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key === 'Tab') keepFocusInside(event, panelRef.current!);
  }

  const isBottom = variant === 'bottom';

  return createPortal(
    <div ref={layerRef} className={styles.layer}>
      <div className={styles.overlay} onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={
          isBottom
            ? styles.bottom
            : [styles.dialog, mascot && styles.withMascot].filter(Boolean).join(' ')
        }
        onKeyDown={handleKeyDown}
      >
        {mascot && (
          <div className={isBottom ? styles.bottomMascot : styles.dialogMascot} aria-hidden="true">
            {mascot}
          </div>
        )}
        {isBottom && (
          <button type="button" className={styles.handle} aria-label="Close" onClick={onClose} />
        )}
        <div className={isBottom ? styles.body : styles.dialogBody}>
          <h2 id={titleId} className={isBottom ? styles.title : styles.dialogTitle}>
            {title}
          </h2>
          {children}
        </div>
        {footer && <div className={isBottom ? styles.footer : styles.dialogFooter}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

function useModalBehaviour(
  open: boolean,
  layerRef: RefObject<HTMLDivElement | null>,
  panelRef: RefObject<HTMLDivElement | null>,
  initialFocusRef: RefObject<HTMLElement | null> | undefined,
) {
  useEffect(() => {
    if (!open) return;
    const layer = layerRef.current!;
    const opener = document.activeElement as HTMLElement | null;

    // Make the rest of the page inert. Only undo what we set, so a sheet opened on top of
    // another sheet gives control back to the first one when it closes.
    const madeInert = [...document.body.children].filter(
      (el) => el !== layer && !el.hasAttribute('inert'),
    );
    madeInert.forEach((el) => el.setAttribute('inert', ''));

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    (initialFocusRef?.current ?? panelRef.current!).focus();

    return () => {
      madeInert.forEach((el) => el.removeAttribute('inert'));
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [open, layerRef, panelRef, initialFocusRef]);
}

/** Wraps Tab from the last control to the first, and Shift+Tab from the first to the last. */
function keepFocusInside(event: KeyboardEvent, panel: HTMLElement) {
  const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === panel)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
