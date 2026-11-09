import { useEffect } from 'react';

/**
 * Follows the part of the screen you can actually see (above the iPhone keyboard) and writes it
 * as `--viewport-height` and `--viewport-top` on <html> (bug 7, 2026-11-09). When the keyboard
 * opens, iPhone shrinks the visible part and scrolls the page to show the focused field, which
 * pushed the whole spelling screen up. A screen sized and placed with these stays where it is.
 * Only on while the screen using it is shown; nothing happens where visualViewport is missing.
 */
export function useVisualViewport(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty('--viewport-height', `${viewport.height}px`);
      root.style.setProperty('--viewport-top', `${viewport.offsetTop}px`);
      // Undo the page scroll iPhone adds for the keyboard; the screen already fits above it.
      if (window.scrollY !== 0) window.scrollTo(0, 0);
      // Inside the screen, keep the field you're typing in visible above the keyboard.
      const focused = document.activeElement;
      if (focused instanceof HTMLInputElement) focused.scrollIntoView?.({ block: 'nearest' });
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      root.style.removeProperty('--viewport-height');
      root.style.removeProperty('--viewport-top');
    };
  }, []);
}
