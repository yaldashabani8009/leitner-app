import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSyncScheduler, WRITE_DELAY_MS } from './scheduler';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createSyncScheduler', () => {
  it('soon(): a burst of changes becomes one sync after a short pause', async () => {
    const run = vi.fn(async () => {});
    const scheduler = createSyncScheduler(run);
    scheduler.soon();
    scheduler.soon();
    await vi.advanceTimersByTimeAsync(WRITE_DELAY_MS - 1);
    scheduler.soon(); // restarts the pause
    await vi.advanceTimersByTimeAsync(WRITE_DELAY_MS - 1);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('now(): one run at a time; a request during a run gives exactly one more run', async () => {
    let finish: () => void = () => {};
    const run = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const scheduler = createSyncScheduler(run);
    const first = scheduler.now();
    void scheduler.now();
    void scheduler.now();
    expect(run).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(2);
    finish();
    await first;
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('a failure (offline) is reported and the next request runs again', async () => {
    const onError = vi.fn();
    const run = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const scheduler = createSyncScheduler(run, onError);
    await scheduler.now();
    await scheduler.now();
    expect(onError).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('stop(): nothing runs any more', async () => {
    const run = vi.fn(async () => {});
    const scheduler = createSyncScheduler(run);
    scheduler.soon();
    scheduler.stop();
    await vi.advanceTimersByTimeAsync(WRITE_DELAY_MS * 2);
    await scheduler.now();
    scheduler.soon();
    expect(run).not.toHaveBeenCalled();
  });
});
