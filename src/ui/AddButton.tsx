import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { Deck } from '../domain/decks/decks';
import { DeckIcon } from './DeckIcon';
import { IconButton } from './IconButton';
import { CloseIcon, PlusIcon } from './icons';
import styles from './AddButton.module.css';

interface AddButtonProps {
  /** The enabled decks, in registry order. */
  decks: readonly Deck[];
  /** A deck was picked: open its add sheet. */
  onPick: (deck: Deck) => void;
  className?: string;
  /** Goes up by one each time the N key asks to open it (laptop shortcut, v3 brief 1.12). */
  openSignal?: number;
}

/**
 * The orange + (v3 brief 1.8, canvas N2). With one enabled deck it opens that deck's add sheet
 * straight away. With more, it rolls out one round button per deck below it and turns into a
 * white ✕; ✕, a tap outside or Esc rolls them back. Reduce motion: they appear without the roll.
 */
export function AddButton({ decks, onPick, className, openSignal = 0 }: AddButtonProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) firstRef.current?.focus();
  }, [open]);

  // N on a laptop: the same as tapping +.
  const seen = useRef(openSignal);
  useEffect(() => {
    if (openSignal === seen.current) return;
    seen.current = openSignal;
    if (decks.length === 1) onPick(decks[0]);
    else setOpen(true);
  }, [openSignal, decks, onPick]);

  function close() {
    setOpen(false);
    toggleRef.current?.focus();
  }

  function pick(deck: Deck) {
    setOpen(false);
    onPick(deck);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  }

  const single = decks.length === 1;
  return (
    <div
      className={[styles.wrap, open && styles.open, className].filter(Boolean).join(' ')}
      onKeyDown={open ? handleKeyDown : undefined}
    >
      {open && <div className={styles.overlay} onClick={close} aria-hidden="true" />}
      <IconButton
        ref={toggleRef}
        label={open ? 'Close add menu' : 'Add word'}
        variant={open ? 'whiteRaised' : 'primary'}
        icon={open ? <CloseIcon size={24} /> : <PlusIcon size={26} />}
        aria-expanded={single ? undefined : open}
        aria-controls={single || !open ? undefined : menuId}
        onClick={() => {
          if (single) onPick(decks[0]);
          else if (open) close();
          else setOpen(true);
        }}
        className={styles.toggle}
      />
      {open && (
        <div id={menuId} role="group" aria-label="Add to which deck?" className={styles.menu}>
          {decks.map((deck, index) => (
            <button
              key={deck.id}
              ref={index === 0 ? firstRef : undefined}
              type="button"
              className={styles.deck}
              style={{ '--index': index } as CSSProperties}
              onClick={() => pick(deck)}
            >
              <span className={styles.tile}>
                <DeckIcon icon={deck.icon} />
              </span>
              {deck.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
