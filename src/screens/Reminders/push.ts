/**
 * Turning on the daily reminder on this device (ADR-018): the browser's push subscription,
 * saved for the account, then a test notification. iPhone: only in the app installed on the
 * Home Screen (iOS 16.4+); elsewhere `pushSupported()` is false and the offer never shows.
 */

import type { ReminderService } from '../../data/reminders';

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** The server's base64url key → the bytes `pushManager.subscribe` wants. */
export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export type TurnOnOutcome = 'on' | 'denied' | 'failed';

/**
 * Call straight from the tap (iPhone only asks for permission right after one): the subscribe
 * call itself shows the "Allow notifications?" prompt.
 */
export async function turnOnReminders(
  publicKey: string,
  registration: ServiceWorkerRegistration,
  reminders: ReminderService,
): Promise<TurnOnOutcome> {
  let subscription: PushSubscription;
  try {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(publicKey),
    });
  } catch (error) {
    const saidNo =
      Notification.permission === 'denied' ||
      (error instanceof DOMException && error.name === 'NotAllowedError');
    return saidNo ? 'denied' : 'failed';
  }
  const json = subscription.toJSON();
  try {
    await reminders.save({
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
    });
  } catch {
    return 'failed'; // offline: nothing saved, ask again another day
  }
  void reminders.sendTest().catch(() => {}); // a missing test notification isn't worth an error
  return 'on';
}
