// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FLY_OUT_MS, useSwipe } from './useSwipe';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function motion(reduced: boolean) {
  vi.stubGlobal('matchMedia', () => ({
    matches: reduced,
    addEventListener() {},
    removeEventListener() {},
  }));
}

describe('useSwipe: the answer is committed inside the gesture (v3 brief 1.4)', () => {
  it('onCommit runs at once; onAnswer after the fly-out', () => {
    motion(false);
    vi.useFakeTimers();
    const onAnswer = vi.fn();
    const onCommit = vi.fn();
    const { result } = renderHook(() => useSwipe(onAnswer, true, onCommit));
    act(() => result.current.flyOut('left'));
    expect(onCommit).toHaveBeenCalledWith(false);
    expect(onAnswer).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(FLY_OUT_MS));
    expect(onAnswer).toHaveBeenCalledWith(false);
    // A second press while the card is leaving does nothing.
    act(() => result.current.flyOut('right'));
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it('with Reduce motion both run at once, commit first', () => {
    motion(true);
    const calls: string[] = [];
    const { result } = renderHook(() =>
      useSwipe(
        () => calls.push('answer'),
        true,
        () => calls.push('commit'),
      ),
    );
    act(() => result.current.flyOut('right'));
    expect(calls).toEqual(['commit', 'answer']);
  });
});
