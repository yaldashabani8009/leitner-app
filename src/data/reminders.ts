/**
 * The daily reminder's cloud side (ADR-018). Screens talk to `ReminderService`, so tests and
 * the end-to-end build pass a fake one.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/** What a device sends after it allows notifications (the browser's PushSubscription keys). */
export interface DeviceSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface ReminderService {
  /** The server's public push key (base64url), or null when offline or not set up. */
  publicKey(): Promise<string | null>;
  /** Saves this device for the signed-in account (once per device; repeats are harmless). */
  save(subscription: DeviceSubscription): Promise<void>;
  /** Asks the server to send "Reminders are on" to this account's devices now. */
  sendTest(): Promise<void>;
  /** The account's reminder settings (ADR-020), or null when offline. */
  settings(userId: string): Promise<ReminderSettings | null>;
  /** Saves a change; the database then works out the next reminder time. Throws when offline. */
  saveSettings(userId: string, change: Partial<ReminderSettings>): Promise<void>;
}

/** Saved on the profile (ADR-020). */
export interface ReminderSettings {
  /** "19:00", in the profile time zone. */
  reminderTime: string;
  remindersOn: boolean;
}

export function createSupabaseReminders(client: SupabaseClient<Database>): ReminderService {
  return {
    async publicKey() {
      try {
        const { data, error } = await client
          .from('app_config')
          .select('value')
          .eq('key', 'vapid_public_key')
          .maybeSingle();
        return error ? null : (data?.value ?? null);
      } catch {
        return null; // offline
      }
    },
    async save(subscription) {
      const { error } = await client
        .from('push_subscriptions')
        .upsert(subscription, { onConflict: 'endpoint' });
      if (error) throw new Error(`Could not save the reminder: ${error.message}`);
    },
    async settings(userId) {
      try {
        const { data, error } = await client
          .from('profiles')
          .select('reminder_time, reminders_on')
          .eq('user_id', userId)
          .maybeSingle();
        if (error || !data) return null;
        return { reminderTime: data.reminder_time.slice(0, 5), remindersOn: data.reminders_on };
      } catch {
        return null; // offline
      }
    },
    async saveSettings(userId, change) {
      const { error } = await client
        .from('profiles')
        .update({
          ...(change.reminderTime !== undefined && { reminder_time: change.reminderTime }),
          ...(change.remindersOn !== undefined && { reminders_on: change.remindersOn }),
        })
        .eq('user_id', userId);
      if (error) throw new Error(`Could not save the reminder settings: ${error.message}`);
    },
    async sendTest() {
      const { error } = await client.functions.invoke('reminders-test', { body: {} });
      if (error) throw new Error(`Could not send the test reminder: ${error.message}`);
    },
  };
}
