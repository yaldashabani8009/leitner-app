import { useEffect, useState } from 'react';

/**
 * How many px the on-screen keyboard covers at the bottom of the page.
 * iPhone Safari doesn't shrink the page when the keyboard opens, so a sheet fixed to the
 * bottom would hide behind it; the visual viewport tells us how much is covered.
 * (Android Chrome resizes the page itself, so this stays 0 there.)
 */
export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!active || !viewport) return;
    const update = () =>
      setInset(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)));
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      setInset(0);
    };
  }, [active]);

  return inset;
}
