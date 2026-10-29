import { useEffect } from 'react';

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/**
 * The number on the app icon: words still waiting today (ADR-018). Installed app only; on
 * iPhone it shows once notifications are allowed. Phones without badges ignore it.
 * (An effect is right here: it talks to the phone; it doesn't fetch data.)
 */
export function useAppBadge(count: number | undefined): void {
  useEffect(() => {
    const nav = navigator as BadgeNavigator;
    if (count === undefined || !nav.setAppBadge || !nav.clearAppBadge) return;
    const done = count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge();
    done.catch(() => {}); // e.g. notifications not allowed yet
  }, [count]);
}
