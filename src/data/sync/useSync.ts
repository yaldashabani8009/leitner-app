import { liveQuery } from 'dexie';
import { useEffect } from 'react';
import type { LeitnerDb } from '../db';
import type { SyncRemote } from './remote';
import { createSyncScheduler, PERIODIC_MS } from './scheduler';
import { createSync } from './sync';

/**
 * Keeps this device in sync while the app is open: on open, shortly after every change,
 * when the connection comes back, when the app returns to the foreground, and every 5 minutes.
 * (An effect is right here: it subscribes to browser events; it doesn't fetch data for the UI.)
 */
export function useSync(db: LeitnerDb, remote: SyncRemote): void {
  useEffect(() => {
    const sync = createSync(db, remote, { now: () => new Date().toISOString() });
    const scheduler = createSyncScheduler(() => sync.run());

    const onOnline = () => void scheduler.now();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void scheduler.now();
    };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    const periodic = setInterval(() => void scheduler.now(), PERIODIC_MS);
    // Every repository write adds to the outbox; that's our "something changed" signal.
    const outbox = liveQuery(() => db.outbox.count()).subscribe((count) => {
      if (count > 0) scheduler.soon();
    });
    void scheduler.now();

    return () => {
      scheduler.stop();
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(periodic);
      outbox.unsubscribe();
    };
  }, [db, remote]);
}
