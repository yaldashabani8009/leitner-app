// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LeitnerDb, META } from '../../data/db';
import { createRepository, type Repository } from '../../data/repository';
import { BackupPrompts } from './BackupPrompts';

const NOW = '2026-03-30T08:00:00.000Z';
const LONG_AGO = '2026-03-01T08:00:00.000Z';

let db: LeitnerDb;
let repo: Repository;

beforeEach(async () => {
  db = new LeitnerDb(`backup-ui-${crypto.randomUUID()}`);
  repo = createRepository(db, { now: () => NOW, newId: () => crypto.randomUUID() });
  await repo.saveProfile({
    userId: 'u1',
    displayName: 'Yali',
    timeZone: 'Asia/Tehran',
    updatedAt: NOW,
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await db.delete();
});

async function addWords(...words: string[]) {
  for (const word of words) {
    await repo.addCard({
      word,
      synonyms: [{ text: 'like' }],
      meanings: [{ text: 'معنی' }],
      sentences: [{ text: `A ${word}.` }],
    });
  }
}

/** A backup file of three words from another box of the same account. */
async function backupFile(userId = 'u1'): Promise<File> {
  const other = new LeitnerDb(`backup-src-${crypto.randomUUID()}`);
  const source = createRepository(other, { now: () => LONG_AGO, newId: () => crypto.randomUUID() });
  for (const word of ['brave', 'calm', 'quiet']) {
    await source.addCard({
      word,
      synonyms: [{ text: 'like' }],
      meanings: [{ text: 'معنی' }],
      sentences: [{ text: `A ${word}.` }],
    });
  }
  const backup = await source.exportBackup(userId);
  await other.delete();
  return new File(
    [JSON.stringify({ ...backup, profile: { displayName: 'Yali', timeZone: 'UTC' } })],
    'b.json',
    {
      type: 'application/json',
    },
  );
}

describe('BackupPrompts', () => {
  it('shows nothing normally', async () => {
    await addWords('brave');
    render(<BackupPrompts repo={repo} userId="u1" />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('"Save a copy?" (14 days without the cloud)', () => {
    beforeEach(async () => {
      await db.meta.put({ key: META.lastSyncedAt, value: LONG_AGO });
      await addWords('brave', 'calm');
    });

    it('opens the share sheet with the backup file, then waits a week', async () => {
      const share = vi.fn<(data: ShareData) => Promise<void>>().mockResolvedValue();
      vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share });
      render(<BackupPrompts repo={repo} userId="u1" />);

      expect(
        await screen.findByRole('dialog', { name: 'Save a copy of your words?' }),
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Save a copy' }));

      await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
      const file = share.mock.calls[0][0].files![0];
      expect(file.name).toBe('leitner-backup-2026-03-30.json');
      const saved = JSON.parse(await file.text());
      expect(saved).toMatchObject({ app: 'leitner-backup', userId: 'u1' });
      expect(saved.cards).toHaveLength(2);

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect((await repo.backupStatus()).saveReminder).toBe(false);
    });

    it('stays open when the share sheet is cancelled', async () => {
      const share = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'));
      vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share });
      render(<BackupPrompts repo={repo} userId="u1" />);
      await userEvent.click(await screen.findByRole('button', { name: 'Save a copy' }));
      await waitFor(() => expect(share).toHaveBeenCalled());
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect((await repo.backupStatus()).saveReminder).toBe(true);
    });

    it('"Not now" closes it and waits a week', async () => {
      render(<BackupPrompts repo={repo} userId="u1" />);
      await userEvent.click(await screen.findByRole('button', { name: 'Not now' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect((await repo.backupStatus()).saveReminder).toBe(false);
    });

    it('waits while another sheet is open', async () => {
      const view = render(<BackupPrompts repo={repo} userId="u1" paused />);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      view.rerender(<BackupPrompts repo={repo} userId="u1" />);
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('"Have a backup file?" (empty box, cloud unreachable)', () => {
    beforeEach(async () => {
      await db.meta.put({ key: META.lastSyncFailedAt, value: NOW });
    });

    it('restores the words from a chosen file', async () => {
      render(<BackupPrompts repo={repo} userId="u1" />);
      expect(
        await screen.findByRole('dialog', { name: 'Have a backup file?' }),
      ).toBeInTheDocument();

      await userEvent.upload(screen.getByLabelText('Backup file'), await backupFile());
      expect(await screen.findByRole('dialog', { name: 'Restore 3 words?' })).toBeInTheDocument();
      expect(screen.getByText('From your backup of 1 Mar 2026.')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
      expect(
        await screen.findByRole('dialog', { name: 'Your words are back!' }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("3 words restored. They'll go to the cloud next time you're online."),
      ).toBeInTheDocument();
      expect(await repo.countCards()).toBe(3);

      await userEvent.click(screen.getByRole('button', { name: 'Done' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('"Cancel" on the check goes back without saving anything', async () => {
      render(<BackupPrompts repo={repo} userId="u1" />);
      await userEvent.upload(await screen.findByLabelText('Backup file'), await backupFile());
      await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
      expect(
        await screen.findByRole('dialog', { name: 'Have a backup file?' }),
      ).toBeInTheDocument();
      expect(await repo.countCards()).toBe(0);
    });

    it.each([
      [
        'a file that is not a backup',
        () => new File(['hello'], 'notes.json', { type: 'application/json' }),
        "This file isn't a Leitner backup.",
      ],
      [
        'a backup from another account',
        () => backupFile('someone-else'),
        'This backup belongs to another account.',
      ],
    ])('explains %s and saves nothing', async (_label, makeFile, message) => {
      render(<BackupPrompts repo={repo} userId="u1" />);
      await userEvent.upload(await screen.findByLabelText('Backup file'), await makeFile());
      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(await repo.countCards()).toBe(0);
    });

    it('"Not now" closes it and waits a week', async () => {
      render(<BackupPrompts repo={repo} userId="u1" />);
      await userEvent.click(await screen.findByRole('button', { name: 'Not now' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect((await repo.backupStatus()).restoreOffer).toBe(false);
    });
  });
});
