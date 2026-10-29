import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import type { ReminderService } from '../../data/reminders';
import type { Repository } from '../../data/repository';
import { Button } from '../../ui/Button';
import { Mascot } from '../../ui/Mascot/Mascot';
import { Sheet } from '../../ui/Sheet';
import styles from '../Backup/BackupPrompts.module.css';
import { pushSupported, turnOnReminders, type TurnOnOutcome } from './push';

type OfferRepo = Pick<Repository, 'reminderOfferOpen' | 'closeReminderOffer'>;

interface ReminderOfferProps {
  repo: OfferRepo;
  reminders?: ReminderService;
  /** True on the screen after "Done for today" / "I'm done for now" (the calm moment after a session). */
  active: boolean;
}

interface Ready {
  publicKey: string;
  registration: ServiceWorkerRegistration;
}

/**
 * "Want a daily reminder?" (Yali, 2026-10-29; ADR-018). Asked once per device, after a session,
 * only where notifications can work and haven't been answered yet. Yes: the phone asks for
 * permission, the device is saved, and a test notification arrives. Not now: again in 7 days.
 */
export function ReminderOffer({ repo, reminders, active }: ReminderOfferProps) {
  const offerOpen = useLiveQuery(() => repo.reminderOfferOpen(), [repo]);
  const [ready, setReady] = useState<Ready | null>(null);
  const [outcome, setOutcome] = useState<TurnOnOutcome | null>(null);
  const [closed, setClosed] = useState(false);

  // Gets the push key and service worker ready before the tap, so "Yes" goes straight to the
  // phone's permission prompt (iPhone only allows it right after a tap). Browser APIs, not UI data.
  useEffect(() => {
    if (!active || !reminders || !pushSupported() || Notification.permission !== 'default') return;
    let cancelled = false;
    void Promise.all([reminders.publicKey(), navigator.serviceWorker.ready]).then(
      ([publicKey, registration]) => {
        if (!cancelled && publicKey) setReady({ publicKey, registration });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [active, reminders]);

  if (closed) return null;

  async function yes() {
    const result = await turnOnReminders(ready!.publicKey, ready!.registration, reminders!);
    await repo.closeReminderOffer(result === 'on' ? 'done' : 'snooze');
    setOutcome(result);
  }

  async function notNow() {
    await repo.closeReminderOffer('snooze');
    setClosed(true);
  }

  // The result shows even though answering has just closed the offer itself.
  if (outcome) {
    const copy = {
      on: {
        title: 'Reminders are on!',
        text: "A test notification is on its way. From now on I'll check in at 19:00.",
      },
      denied: {
        title: 'Notifications are off',
        text: 'Your phone said no. You can allow them later in Settings → Notifications → Leitner.',
      },
      failed: {
        title: "Couldn't turn it on",
        text: "I couldn't reach the cloud. I'll ask again another day.",
      },
    }[outcome];
    return (
      <Sheet
        open
        variant="dialog"
        title={copy.title}
        onClose={() => setClosed(true)}
        mascot={<Mascot pose={outcome === 'on' ? 'happy' : 'cheer'} size="small" decorative />}
        footer={<Button onClick={() => setClosed(true)}>Done</Button>}
      >
        <p className={styles.text}>{copy.text}</p>
      </Sheet>
    );
  }

  if (!active || !offerOpen || !ready || !reminders) return null;
  return (
    <Sheet
      open
      variant="dialog"
      title="Want a daily reminder?"
      onClose={() => void notNow()}
      mascot={<Mascot pose="wave" size="small" decorative />}
      footer={
        <>
          <Button onClick={() => void yes()}>Yes, remind me</Button>
          <Button variant="text" onClick={() => void notNow()}>
            Not now
          </Button>
        </>
      }
    >
      <p className={styles.text}>
        At 19:00 I'll let you know when words are waiting, or when your streak needs a new word.
        Never more than once a day.
      </p>
    </Sheet>
  );
}
