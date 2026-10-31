import { useEffect } from 'react';

interface AppShortcuts {
  /** N: open the + (its roll-out, or the add sheet when one deck is on). */
  onAdd?: () => void;
  /** H: go Home (Today). */
  onHome?: () => void;
  /** /: focus the search on the all-words page. */
  onSearch?: () => void;
}

/**
 * Laptop shortcuts for the whole app (v3 brief 1.12, canvas L4): N add, H home, / search.
 * Same rules as the card keys (useReviewKeys): never while typing, never with a sheet or
 * dialog open, never with Ctrl, ⌘ or Alt held, so browser shortcuts keep working.
 * (An effect is right here: it listens to the keyboard; it doesn't fetch data.)
 */
export function useAppShortcuts({ onAdd, onHome, onSearch }: AppShortcuts): void {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.repeat) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

      const key = event.key.toLowerCase();
      const action =
        key === 'n' ? onAdd : key === 'h' ? onHome : key === '/' ? onSearch : undefined;
      if (!action) return;
      event.preventDefault(); // "/" opens Firefox's quick find otherwise
      action();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onAdd, onHome, onSearch]);
}
