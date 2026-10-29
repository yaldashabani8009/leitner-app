import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import type { Repository } from '../../data/repository';
import type { CardDraft, CardField, FieldErrors } from '../../domain/card/validate';
import { Button } from '../../ui/Button';
import { Mascot } from '../../ui/Mascot/Mascot';
import { Sheet } from '../../ui/Sheet';
import styles from './AddEditSheet.module.css';
import { WordForm } from './WordForm';

type AddEditRepo = Pick<
  Repository,
  'addCard' | 'editCard' | 'getCard' | 'findCardIdByWord' | 'sendCardBackToStart'
>;

export type Editor = { mode: 'add' } | { mode: 'edit'; cardId: string };

interface AddEditSheetProps {
  repo: AddEditRepo;
  /** null = closed. */
  editor: Editor | null;
  onClose: () => void;
  /** "Open my card" in the duplicate dialog: the card is back at the start; show it. */
  onOpenCard: (cardId: string) => void;
}

const FORM_ID = 'word-form';

/**
 * Add word / Edit word bottom sheet (PRD user flow 7–8, canvas 09–11).
 * Adding a word you already have asks first (decided 2026-10-29): "Open my card" sends that
 * card back to box 1, due tomorrow, and shows it; "Cancel" changes nothing.
 */
export function AddEditSheet({ repo, editor, onClose, onOpenCard }: AddEditSheetProps) {
  const editingId = editor?.mode === 'edit' ? editor.cardId : null;
  const editing = useLiveQuery(
    async () => (editingId ? ((await repo.getCard(editingId)) ?? null) : null),
    [repo, editingId],
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [duplicate, setDuplicate] = useState<{ cardId: string; word: string } | null>(null);
  const saving = useRef(false);
  const wordRef = useRef<HTMLInputElement>(null);

  if (!editor) return null;
  // Wait for the card before showing the edit form, so it starts filled in.
  if (editor.mode === 'edit' && (!editing || editing.card.id !== editor.cardId)) return null;

  function close() {
    setErrors({});
    setDuplicate(null);
    onClose();
  }

  function clearError(field: CardField) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function save(draft: CardDraft) {
    if (saving.current || !editor) return;
    saving.current = true;
    try {
      if (editor.mode === 'edit') {
        const result = await repo.editCard(editor.cardId, draft);
        if (result.status === 'invalid') setErrors(result.errors);
        else close();
        return;
      }
      // A word you already have: ask before changing anything (PRD duplicate rule).
      const existingId = draft.word.trim() ? await repo.findCardIdByWord(draft.word) : undefined;
      if (existingId) {
        setDuplicate({ cardId: existingId, word: draft.word.trim() });
        return;
      }
      const result = await repo.addCard(draft);
      if (result.status === 'invalid') setErrors(result.errors);
      else if (result.status === 'duplicate') {
        // Added on another device a moment ago: same outcome as "Open my card".
        close();
        onOpenCard(result.cardId);
      } else close();
    } finally {
      saving.current = false;
    }
  }

  async function openExisting() {
    if (!duplicate) return;
    await repo.sendCardBackToStart(duplicate.cardId);
    const cardId = duplicate.cardId;
    close();
    onOpenCard(cardId);
  }

  const isEdit = editor.mode === 'edit';
  return (
    <Sheet
      open
      onClose={close}
      title={isEdit ? 'Edit word' : 'New word'}
      mascot={<Mascot pose="write" size="small" decorative />}
      initialFocusRef={isEdit ? undefined : wordRef}
      footer={
        <Button type="submit" form={FORM_ID}>
          {isEdit ? 'Save changes' : 'Save word'}
        </Button>
      }
    >
      {isEdit && <p className={styles.note}>Editing won't change when you see this word next.</p>}
      <WordForm
        key={isEdit ? editor.cardId : 'new'}
        id={FORM_ID}
        mode={editor.mode}
        initial={editing ?? undefined}
        errors={errors}
        onClearError={clearError}
        onSubmit={(draft) => void save(draft)}
        wordRef={wordRef}
      />

      <Sheet
        open={duplicate !== null}
        onClose={() => setDuplicate(null)}
        variant="dialog"
        title={`Oh! You already have “${duplicate?.word ?? ''}”`}
        mascot={<Mascot pose="idle" size="small" decorative />}
        footer={
          <>
            <Button onClick={() => void openExisting()}>Open my card</Button>
            <Button variant="text" onClick={() => setDuplicate(null)}>
              Cancel
            </Button>
          </>
        }
      >
        <p className={styles.dialogText}>
          I'll open your card and move it back to the start, so you'll see it again tomorrow.
        </p>
      </Sheet>
    </Sheet>
  );
}
