import { useEffect, useId, useState } from 'react';
import type { ReminderService, ReminderSettings } from '../../data/reminders';
import { DEFAULT_REMINDER_TIME, REMINDER_TIME_STEP_MINUTES } from '../../domain/leitner/config';
import { roundToStep } from '../../domain/reminder/reminder';
import { Sheet } from '../../ui/Sheet';
import { pushSupported, turnOnReminders } from '../Reminders/push';
import styles from './SettingsSheet.module.css';

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  /** The profile's display name, for "Signed in as Yali". */
  name: string | null;
  /** The daily reminder (ADR-018, ADR-020); without it the reminder rows don't show. */
  reminders?: ReminderService;
  /** This device now gets reminders: the "Want a daily reminder?" offer never shows again. */
  onDeviceOn?: () => void;
  onSignOut: () => void;
}

/**
 * Settings (v3 brief 1.10, canvas N13), from the button top left on Today: the daily reminder
 * on/off, its time in 15-minute steps (default 19:00), "Signed in as Yali" and Sign out.
 * No time-zone setting: it follows the profile.
 */
export function SettingsSheet({
  open,
  onClose,
  userId,
  name,
  reminders,
  onDeviceOn,
  onSignOut,
}: SettingsSheetProps) {
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [problem, setProblem] = useState(false);
  const [device, setDevice] = useState<{
    publicKey: string;
    registration: ServiceWorkerRegistration;
  } | null>(null);
  const labelId = useId();
  const timeId = useId();

  // Not a data read for the screen's own data: the settings live in the cloud profile.
  useEffect(() => {
    if (!open || !reminders) return;
    let cancelled = false;
    setProblem(false);
    void reminders.settings(userId).then((loaded) => {
      if (cancelled) return;
      setSettings(loaded ?? { reminderTime: DEFAULT_REMINDER_TIME, remindersOn: true });
      setProblem(loaded === null);
    });
    // Get the push key ready now: iPhone only asks for permission straight from a tap.
    if (pushSupported() && Notification.permission !== 'granted') {
      void Promise.all([reminders.publicKey(), navigator.serviceWorker.ready]).then(
        ([publicKey, registration]) => {
          if (!cancelled && publicKey) setDevice({ publicKey, registration });
        },
      );
    }
    return () => {
      cancelled = true;
    };
  }, [open, reminders, userId]);

  async function save(change: Partial<ReminderSettings>) {
    if (!reminders || !settings) return;
    const before = settings;
    setSettings({ ...settings, ...change });
    try {
      await reminders.saveSettings(userId, change);
      setProblem(false);
    } catch {
      setSettings(before);
      setProblem(true);
    }
  }

  function toggle() {
    if (!settings) return;
    const on = !settings.remindersOn;
    // Turning on from a device that never allowed notifications: ask now, from this tap.
    if (on && device && reminders) {
      void turnOnReminders(device.publicKey, device.registration, reminders).then((outcome) => {
        if (outcome === 'on') onDeviceOn?.();
      });
    }
    void save({ remindersOn: on });
  }

  return (
    <Sheet open={open} onClose={onClose} title="Settings">
      {reminders && (
        <div className={styles.group}>
          <div className={styles.row}>
            <div className={styles.text}>
              <span id={labelId} className={styles.label}>
                Daily reminder
              </span>
              <span className={styles.hint}>One nudge when cards are waiting</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings?.remindersOn ?? false}
              aria-labelledby={labelId}
              disabled={!settings}
              className={styles.switch}
              onClick={toggle}
            >
              <span className={styles.knob} />
            </button>
          </div>
          <div className={styles.divider} />
          <div className={styles.row}>
            <label htmlFor={timeId} className={`${styles.label} ${styles.grow}`}>
              Remind me at
            </label>
            <input
              id={timeId}
              type="time"
              step={REMINDER_TIME_STEP_MINUTES * 60}
              className={styles.time}
              value={settings?.reminderTime ?? DEFAULT_REMINDER_TIME}
              disabled={!settings || !settings.remindersOn}
              onChange={(event) => {
                if (!event.target.value) return;
                void save({
                  reminderTime: roundToStep(event.target.value, REMINDER_TIME_STEP_MINUTES),
                });
              }}
            />
          </div>
        </div>
      )}
      {problem && (
        <p role="status" className={styles.problem}>
          Couldn't reach your account. Check your connection and try again.
        </p>
      )}
      <p className={styles.signedIn}>{name ? `Signed in as ${name}` : 'Signed in'}</p>
      <button type="button" className={styles.signOut} onClick={onSignOut}>
        Sign out
      </button>
    </Sheet>
  );
}
