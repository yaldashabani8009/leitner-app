import { useLayoutEffect, useRef, type ReactNode } from 'react';

interface FitTextProps {
  /** The text it shows; it is fitted again when this changes. */
  text: string;
  /** Largest and smallest font size, in px. */
  max: number;
  min: number;
  className?: string;
  /** What to show instead of `text` (e.g. letters marked up); fitted the same way. */
  children?: ReactNode;
}

/**
 * Text that shrinks until its longest word fits on one line (bug 2, 2026-11-09: "Contemporar /
 * y"). Lines only break at spaces, so a phrase still wraps; a single long word gets smaller
 * instead of being cut in two. Below `min` it may overflow rather than become unreadable.
 * The element needs `overflow-wrap: normal` and a width set by its container.
 */
export function FitText({ text, max, min, className, children }: FitTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const fit = () => {
      let size = max;
      element.style.fontSize = `${size}px`;
      while (size > min && element.scrollWidth > element.clientWidth) {
        size -= 1;
        element.style.fontSize = `${size}px`;
      }
    };
    fit();
    // Again when the card changes width (rotation, laptop window) and once the font has loaded.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    observer?.observe(element);
    void document.fonts?.ready.then(fit);
    return () => observer?.disconnect();
  }, [text, max, min]);
  return (
    <span ref={ref} className={className}>
      {children ?? text}
    </span>
  );
}
