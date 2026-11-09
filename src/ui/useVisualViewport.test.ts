// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useVisualViewport } from './useVisualViewport';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function fakeViewport() {
  const target = new EventTarget();
  return Object.assign(target, { height: 852, offsetTop: 0 });
}

describe('useVisualViewport (bug 7, 2026-11-09)', () => {
  it('writes the visible height and top, follows the keyboard, and undoes the page scroll', () => {
    const viewport = fakeViewport();
    vi.stubGlobal('visualViewport', viewport);
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const root = document.documentElement;
    const { unmount } = renderHook(() => useVisualViewport());
    expect(root.style.getPropertyValue('--viewport-height')).toBe('852px');
    expect(scrollTo).not.toHaveBeenCalled();

    // The keyboard opens: less to see, and iPhone scrolls the page.
    viewport.height = 440;
    viewport.offsetTop = 120;
    vi.stubGlobal('scrollY', 120);
    viewport.dispatchEvent(new Event('resize'));
    expect(root.style.getPropertyValue('--viewport-height')).toBe('440px');
    expect(root.style.getPropertyValue('--viewport-top')).toBe('120px');
    expect(scrollTo).toHaveBeenCalledWith(0, 0);

    // The field being typed in is kept in view.
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    input.scrollIntoView = vi.fn();
    viewport.dispatchEvent(new Event('scroll'));
    expect(input.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    input.remove();

    unmount();
    expect(root.style.getPropertyValue('--viewport-height')).toBe('');
  });

  it('does nothing without visualViewport', () => {
    vi.stubGlobal('visualViewport', undefined);
    renderHook(() => useVisualViewport());
    expect(document.documentElement.style.getPropertyValue('--viewport-height')).toBe('');
  });
});
