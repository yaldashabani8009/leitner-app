import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useDrag } from '@use-gesture/react';
import { createPortal } from 'react-dom';
import { IconButton } from './IconButton';
import { CloseIcon } from './icons';
import styles from './Sheet.module.css';
import { useVisibleArea } from './useVisibleArea';

interface SheetProps {
  open: boolean;
  /** Called on Esc, a tap on the dim overlay, or the round ✕ (bottom sheet). The parent sets open to false. */
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
  /** Shown right after the title, e.g. the deck chip of the add sheet (canvas N4). */
  titleAddon?: ReactNode;
  /** A tap on the dim layer closes the sheet (default). The add sheet closes only with ✕, Esc or a drag. */
  closeOnOverlay?: boolean;
  /** Sits above the dim layer and the sheet, e.g. the "saved" toast (canvas N4). */
  toast?: ReactNode;
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
  titleAddon,
  closeOnOverlay = true,
  toast,
  children,
}: SheetProps) {
  const titleId = useId();
  const layerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useModalBehaviour(open, layerRef, panelRef, initialFocusRef);
  const visible = useVisibleArea(open && variant === 'bottom');
  const drag = useDragToClose(onClose, open && variant === 'bottom');

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
    <div
      ref={layerRef}
      className={[styles.layer, visible?.keyboardOpen && styles.keyboardOpen]
        .filter(Boolean)
        .join(' ')}
      // Follow what is actually visible, so the sheet sits on top of the iPhone keyboard.
      style={
        visible
          ? ({ top: `${visible.top}px`, height: `${visible.height}px` } as CSSProperties)
          : undefined
      }
    >
      <div
        className={styles.overlay}
        onClick={closeOnOverlay ? onClose : undefined}
        aria-hidden="true"
      />
      {toast}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={
          isBottom
            ? [styles.bottom, drag.dragging && styles.dragging].filter(Boolean).join(' ')
            : [styles.dialog, mascot && styles.withMascot].filter(Boolean).join(' ')
        }
        style={isBottom ? ({ '--drag-y': `${drag.offset}px` } as CSSProperties) : undefined}
        onKeyDown={handleKeyDown}
      >
        {mascot && (
          <div className={isBottom ? styles.bottomMascot : styles.dialogMascot} aria-hidden="true">
            {mascot}
          </div>
        )}
        {isBottom && (
          // Drag the handle strip down to close (Yali, 2026-10-29); ✕ and Esc still work.
          <div className={styles.grab} {...drag.bind()} aria-hidden="true">
            <div className={styles.handle} />
          </div>
        )}
        <div
          className={isBottom ? styles.body : styles.dialogBody}
          onFocus={isBottom ? revealField : undefined}
        >
          {isBottom ? (
            <div className={styles.header}>
              <div className={styles.titleGroup}>
                <h2 id={titleId} className={styles.title}>
                  {title}
                </h2>
                {titleAddon}
              </div>
              <IconButton label="Close" variant="white" icon={<CloseIcon />} onClick={onClose} />
            </div>
          ) : (
            <h2 id={titleId} className={styles.dialogTitle}>
              {title}
            </h2>
          )}
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

/** Pull past this many px (or flick down) to close the sheet. */
export const CLOSE_DRAG_PX = 110;

/** Swipe the bottom sheet down by its handle to close it; a short drag springs back. */
function useDragToClose(onClose: () => void, enabled: boolean) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const bind = useDrag(
    ({ active, movement: [, my], velocity: [, vy], direction: [, dy] }) => {
      const down = Math.max(0, my);
      if (active) {
        setDragging(true);
        setOffset(down);
        return;
      }
      setDragging(false);
      setOffset(0);
      // Far enough, or a quick flick down that still travelled a little.
      if (down >= CLOSE_DRAG_PX || (down > 60 && vy > 0.8 && dy > 0)) onClose();
    },
    { enabled, axis: 'y', filterTaps: true },
  );
  return { bind, offset, dragging };
}

/** Once the keyboard has opened, scroll the tapped field into view inside the sheet. */
function revealField(event: FocusEvent<HTMLDivElement>) {
  const field = event.target;
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;
  setTimeout(() => field.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }), 300);
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
