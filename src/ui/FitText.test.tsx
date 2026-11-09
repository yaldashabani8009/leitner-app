// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FitText } from './FitText';

// jsdom has no layout: each letter is 0.8 × the font size wide; the box is 300px wide.
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 300,
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get(this: HTMLElement) {
      return parseFloat(this.style.fontSize || '0') * (this.textContent?.length ?? 0) * 0.8;
    },
  });
});
afterEach(() => {
  cleanup();
  // Back to jsdom's own (on Element.prototype).
  for (const key of ['clientWidth', 'scrollWidth']) {
    Reflect.deleteProperty(HTMLElement.prototype, key);
  }
});

describe('FitText (bug 2, 2026-11-09)', () => {
  it('a short word keeps the largest size', () => {
    render(<FitText text="calm" max={42} min={24} />);
    expect(screen.getByText('calm').style.fontSize).toBe('42px');
  });

  it('a long word shrinks until it fits on one line', () => {
    // 12 letters × 0.8 × size ≤ 300 → size ≤ 31.
    render(<FitText text="Contemporary" max={42} min={24} />);
    expect(screen.getByText('Contemporary').style.fontSize).toBe('31px');
  });

  it('never goes below the smallest size', () => {
    render(<FitText text="Pneumonoultramicroscopic" max={42} min={24} />);
    expect(screen.getByText('Pneumonoultramicroscopic').style.fontSize).toBe('24px');
  });

  it('fits again when the text changes, and can show other content', () => {
    const { rerender } = render(<FitText text="Contemporary" max={42} min={24} />);
    rerender(
      <FitText text="calm" max={42} min={24}>
        <b>calm</b>
      </FitText>,
    );
    expect(screen.getByText('calm').parentElement!.style.fontSize).toBe('42px');
  });
});
