import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState, type ChangeEvent } from 'react';
import type { Repository } from '../../data/repository';
import {
  backupFileName,
  readBackup,
  wordCount,
  type Backup,
  type BackupProblem,
} from '../../domain/backup/file';
import { resolveTimeZone } from '../../domain/time/zonedDate';
import { Button } from '../../ui/Button';
import { Mascot } from '../../ui/Mascot/Mascot';
import { Sheet } from '../../ui/Sheet';
import styles from './BackupPrompts.module.css';
import { saveFile } from './saveFile';

type BackupRepo = Pick<
  Repository,
  'backupStatus' | 'snoozeBackup' | 'exportBackup' | 'importBackup'
>;

interface BackupPromptsProps {
  repo: BackupRepo;
  userId: string;
  /** True while another sheet is open: wait, so two modals never stack. */
  paused?: boolean;
}

/**
 * The automatic backup (Yali's decisions, 2026-10-29): no button or screen in the app.
 * A modal appears only when it's needed (see domain/backup/reminder.ts):
 * "Save a copy?" after 14 days without the cloud, "Restore your words?" when the box is
 * empty and the cloud can't be reached. Each shows at most once per app start.
 */
export function BackupPrompts({ repo, userId, paused = false }: BackupPromptsProps) {
  const status = useLiveQuery(() => repo.backupStatus(), [repo]);
  const [open, setOpen] = useState<'save' | 'restore' | null>(null);
  const [shown, setShown] = useState<('save' | 'restore')[]>([]);

  if (open === null && !paused && status) {
    const next = status.saveReminder ? 'save' : status.restoreOffer ? 'restore' : null;
    if (next && !shown.includes(next)) {
      setShown([...shown, next]);
      setOpen(next);
    }
  }

  if (open === 'save')
    return <SaveCopy repo={repo} userId={userId} onClose={() => setOpen(null)} />;
  if (open === 'restore')
    return <Restore repo={repo} userId={userId} onClose={() => setOpen(null)} />;
  return null;
}

interface DialogProps {
  repo: BackupRepo;
  userId: string;
  onClose: () => void;
}

function zoneOf(backup: Backup): string {
  return resolveTimeZone(backup.profile?.timeZone);
}

function SaveCopy({ repo, userId, onClose }: DialogProps) {
  // Made ready while the modal is open, so the tap goes straight to the share sheet.
  const backup = useLiveQuery(() => repo.exportBackup(userId), [repo, userId]);

  async function notNow() {
    await repo.snoozeBackup('save');
    onClose();
  }

  async function save() {
    // Tapped in the first few milliseconds: make it now (the share sheet may then refuse,
    // and saveFile falls back to a download).
    const data = backup ?? (await repo.exportBackup(userId));
    const file = new File([JSON.stringify(data)], backupFileName(data.exportedAt, zoneOf(data)), {
      type: 'application/json',
    });
    if ((await saveFile(file)) === 'cancelled') return;
    await repo.snoozeBackup('save');
    onClose();
  }

  return (
    <Sheet
      open
      variant="dialog"
      title="Save a copy of your words?"
      onClose={() => void notNow()}
      mascot={<Mascot pose="write" size="small" decorative />}
      footer={
        <>
          <Button onClick={() => void save()}>Save a copy</Button>
          <Button variant="text" onClick={() => void notNow()}>
            Not now
          </Button>
        </>
      }
    >
      <p className={styles.text}>
        I haven't reached the cloud for a while. Keep a copy of your words on this device, just in
        case.
      </p>
    </Sheet>
  );
}

const PROBLEMS: Record<BackupProblem | 'otherAccount', string> = {
  notABackup: "This file isn't a Leitner backup.",
  newerVersion: 'This backup is from a newer version of the app. Update the app first.',
  damaged: 'This backup file is damaged.',
  otherAccount: 'This backup belongs to another account.',
};

type RestoreStep =
  | { step: 'ask'; problem?: string }
  | { step: 'confirm'; backup: Backup }
  | { step: 'done'; words: number };

function Restore({ repo, userId, onClose }: DialogProps) {
  const [state, setState] = useState<RestoreStep>({ step: 'ask' });
  const fileInput = useRef<HTMLInputElement>(null);

  async function notNow() {
    await repo.snoozeBackup('restore');
    onClose();
  }

  async function chosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // so choosing the same file again still counts
    if (!file) return;
    const result = readBackup(await file.text());
    if (!result.ok) setState({ step: 'ask', problem: PROBLEMS[result.problem] });
    else if (result.backup.userId !== userId)
      setState({ step: 'ask', problem: PROBLEMS.otherAccount });
    else setState({ step: 'confirm', backup: result.backup });
  }

  async function restore(backup: Backup) {
    const result = await repo.importBackup(backup, userId);
    if (result.status === 'otherAccount') setState({ step: 'ask', problem: PROBLEMS.otherAccount });
    else setState({ step: 'done', words: wordCount(backup) });
  }

  const words = (n: number) => (n === 1 ? '1 word' : `${n} words`);

  if (state.step === 'done') {
    return (
      <Sheet
        open
        variant="dialog"
        title="Your words are back!"
        onClose={onClose}
        mascot={<Mascot pose="happy" size="small" decorative />}
        footer={<Button onClick={onClose}>Done</Button>}
      >
        <p className={styles.text}>
          {words(state.words)} restored. They'll go to the cloud next time you're online.
        </p>
      </Sheet>
    );
  }

  if (state.step === 'confirm') {
    const { backup } = state;
    const date = new Date(backup.exportedAt).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: zoneOf(backup),
    });
    return (
      <Sheet
        open
        variant="dialog"
        title={`Restore ${words(wordCount(backup))}?`}
        onClose={() => setState({ step: 'ask' })}
        mascot={<Mascot pose="idle" size="small" decorative />}
        footer={
          <>
            <Button onClick={() => void restore(backup)}>Restore</Button>
            <Button variant="text" onClick={() => setState({ step: 'ask' })}>
              Cancel
            </Button>
          </>
        }
      >
        <p className={styles.text}>From your backup of {date}.</p>
      </Sheet>
    );
  }

  return (
    <Sheet
      open
      variant="dialog"
      title="Have a backup file?"
      onClose={() => void notNow()}
      mascot={<Mascot pose="idle" size="small" decorative />}
      footer={
        <>
          <Button onClick={() => fileInput.current?.click()}>Choose backup file</Button>
          <Button variant="text" onClick={() => void notNow()}>
            Not now
          </Button>
        </>
      }
    >
      <p className={styles.text}>
        Your box is empty and I can't reach the cloud right now. If you saved a copy of your words,
        you can bring them back.
      </p>
      {state.problem && (
        <p className={styles.problem} role="alert">
          {state.problem}
        </p>
      )}
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        aria-label="Backup file"
        onChange={(event) => void chosen(event)}
      />
    </Sheet>
  );
}
