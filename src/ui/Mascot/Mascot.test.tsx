// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Mascot } from './Mascot';
import { MASCOT_POSES, POSES } from './poses';

/** Pretend the phone's "Reduce motion" setting is on or off. */
function mockReducedMotion(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      get matches() {
        return matches;
      },
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    })),
  );
  return (next: boolean) => {
    matches = next;
    listeners.forEach((fn) => fn());
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Mascot', () => {
  it('has all 8 poses from the canvas', () => {
    expect(MASCOT_POSES).toEqual([
      'wave',
      'idle',
      'happy',
      'cheer',
      'celebrate',
      'flame',
      'sleep',
      'write',
    ]);
  });

  it.each(MASCOT_POSES)('draws the %s pose with a name for screen readers', (pose) => {
    render(<Mascot pose={pose} />);
    const mascot = screen.getByRole('img', { name: POSES[pose].label });
    expect(mascot).toHaveAttribute('data-pose', pose);
  });

  it('is 190px with legs when large (the default)', () => {
    const { container } = render(<Mascot pose="idle" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('width', '190');
    expect(svg.querySelector('[data-part="legs"]')).not.toBeNull();
  });

  it('is 84px without legs when small', () => {
    const { container } = render(<Mascot pose="idle" size="small" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('width', '84');
    expect(svg.querySelector('[data-part="legs"]')).toBeNull();
  });

  it('has a white body on the practice screen', () => {
    const { container } = render(<Mascot pose="idle" body="white" />);
    expect(container.querySelector('svg')!.getAttribute('class')).toMatch(/whiteBody/);
  });

  it('can be hidden from screen readers', () => {
    const { container } = render(<Mascot pose="wave" decorative />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('moves when motion is allowed', () => {
    mockReducedMotion(false);
    const { container } = render(<Mascot pose="wave" />);
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('data-moving', 'true');
    expect(svg.getAttribute('class')).toMatch(/wave/);
  });

  it('stays still when "Reduce motion" is on, and follows the setting live', () => {
    const setReducedMotion = mockReducedMotion(true);
    const { container } = render(<Mascot pose="wave" />);
    const svg = () => container.querySelector('svg')!;
    expect(svg()).toHaveAttribute('data-moving', 'false');
    expect(svg().getAttribute('class')).not.toMatch(/wave/);

    act(() => setReducedMotion(false));
    expect(svg()).toHaveAttribute('data-moving', 'true');
  });

  it('can be kept still on purpose', () => {
    mockReducedMotion(false);
    const { container } = render(<Mascot pose="celebrate" still />);
    expect(container.querySelector('svg')).toHaveAttribute('data-moving', 'false');
  });

  it('still works in browsers that cannot report the setting', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { container } = render(<Mascot pose="idle" />);
    // No setting to read: treat it as "no preference", so the mascot may move.
    expect(container.querySelector('svg')).toHaveAttribute('data-moving', 'true');
  });
});
