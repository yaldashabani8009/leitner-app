import { useEffect, useState } from 'react';

export interface VisibleArea {
  /** Height of what is actually visible, in px (smaller while the keyboard is open). */
  height: number;
  /** How far iPhone Safari has scrolled the page to keep a field in view, in px. */
  top: number;
  /** True while the on-screen keyboard covers part of the page. */
  keyboardOpen: boolean;
}

/** Below this the difference is browser chrome (toolbars), not a keyboard. */
const KEYBOARD_MIN_PX = 120;

/**
 * The part of the page the user can actually see (the "visual viewport").
 * iPhone Safari does not shrink the page when the keyboard opens; it covers the bottom and
 * scrolls the page instead. A sheet that follows this area stays on top of the keyboard and
 * never slides out of view (Yali's iPhone test, 2026-10-29). Null when not active.
 */
export function useVisibleArea(active: boolean): VisibleArea | null {
  const [area, setArea] = useState<VisibleArea | null>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!active || !viewport) return;
    const update = () =>
      setArea({
        height: Math.round(viewport.height),
        top: Math.round(viewport.offsetTop),
        keyboardOpen: window.innerHeight - viewport.height > KEYBOARD_MIN_PX,
      });
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      setArea(null);
    };
  }, [active]);

  return area;
}
