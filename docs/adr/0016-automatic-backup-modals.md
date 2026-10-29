# ADR-016: Backup happens by itself; a modal only when it's needed

- **Status:** Accepted
- **Date:** 2026-10-29

## Context

The PRD listed "Export / Import backup (JSON)" for one case: being offline for a long time (for example in Iran, where Supabase can be blocked) and the phone losing the app's data before sync works again. Normally the backup is already automatic: every change is saved on the device (with persistent storage requested) and copied to the cloud by sync (ADR-003).

Yali's view (2026-10-29): a backup should happen without the person noticing, so it shouldn't be a button or a screen in the app. A website can't write a file to the phone without a tap (iPhone Safari blocks it), so a completely silent file backup isn't possible.

## Options considered

1. **No manual backup:** rely on sync + on-device storage. Fully invisible; the rare case above can lose the words added since the last sync.
2. **Invisible unless needed:** a modal appears only when the cloud hasn't been reached for a long time, and a restore modal only when the box is empty and the cloud can't be reached.
3. **A settings button** with Export / Import: always there, but visible all the time.

## Decision

**Option 2**, as modals over the current screen (Yali's decision, 2026-10-29):

- **"Save a copy of your words?"** shows when there are changes waiting for the cloud and the last finished sync is at least **14 days** old (with no sync ever, counted from the oldest waiting change). "Save a copy" opens the share sheet (Save to Files, AirDrop, email), or downloads the file where sharing isn't available. "Not now" or a saved copy waits **7 days** before asking again. Numbers in `src/domain/leitner/config.ts`.
- **"Have a backup file?"** shows when this device's box is empty, it never finished a sync, and the latest sync attempt failed. Choose file → "Restore N words?" → "Your words are back!". "Not now" waits 7 days.
- Each modal shows at most once per app start, and waits while the add / edit sheet is open.
- **File:** `leitner-backup-YYYY-MM-DD.json` (date in the profile time zone): app name, version 1, export time, account id, profile (name, time zone), and every card, list item, review log and streak day, deleted rows included. `src/domain/backup/file.ts` checks every row before anything is saved; a file from another account, a newer app version or a damaged file is refused with a plain message.
- **Restore merges** with the same rules as sync (ADR-003, ADR-013): the newer edit of a row wins, review logs and streak days are only added, and a word that already exists under another card keeps that card (lists combined, history moved). All or nothing; everything restored is queued for the cloud; restoring the same file twice changes nothing.
- The device remembers when sync last finished and when it last failed (Dexie `meta`, device-only).

## Consequences

- No settings screen exists. Sign out (a future idea) needs its own place.
- If the person never taps "Save a copy" during a long offline stretch and the phone loses its data, the words since the last sync are still lost; the modal makes that unlikely, not impossible.
- iPhone Safari only opens the share sheet straight after a tap, so the file is prepared while the modal is open.
