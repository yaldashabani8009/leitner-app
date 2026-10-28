/**
 * When to sync: one run at a time, a short delay after writes so a burst of answers
 * becomes one upload, and failures just wait for the next chance (offline is normal).
 */

export const WRITE_DELAY_MS = 2000;
export const PERIODIC_MS = 5 * 60 * 1000;

export interface SyncScheduler {
  /** Sync now (or right after the current run). */
  now(): Promise<void>;
  /** Sync after a short pause; repeated calls restart the pause. */
  soon(): void;
  stop(): void;
}

export function createSyncScheduler(
  run: () => Promise<unknown>,
  onError: (error: unknown) => void = () => {},
  delayMs = WRITE_DELAY_MS,
): SyncScheduler {
  let running: Promise<void> | null = null;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  async function loop(): Promise<void> {
    do {
      again = false;
      try {
        await run();
      } catch (error) {
        onError(error);
      }
    } while (again && !stopped);
  }

  function now(): Promise<void> {
    if (stopped) return Promise.resolve();
    if (running) {
      again = true;
      return running;
    }
    running = loop().finally(() => {
      running = null;
    });
    return running;
  }

  return {
    now,
    soon() {
      if (stopped) return;
      clearTimeout(timer);
      timer = setTimeout(() => void now(), delayMs);
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
