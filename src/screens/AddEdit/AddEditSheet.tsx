import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CardWithEntries, Repository } from '../../data/repository';
import {
  wordKey,
  type CardDraft,
  type CardField,
  type FieldErrors,
} from '../../domain/card/validate';
import { mergeTypedIntoCard } from '../../domain/card/merge';
import type { Deck } from '../../domain/decks/decks';
import { Button } from '../../ui/Button';
import { DeckChip } from '../../ui/DeckChip';
import { Mascot } from '../../ui/Mascot/Mascot';
import { Sheet } from '../../ui/Sheet';
import { Toast } from '../../ui/Toast';
import styles from './AddEditSheet.module.css';
import { WordForm } from './WordForm';

type AddEditRepo = Pick<
  Repository,
  'addCard' | 'editCard' | 'getCard' | 'findCardIdByWord' | 'saveAndStartOver'
>;

export type Editor = { mode: 'add'; deck: Deck } | { mode: 'edit'; cardId: string };

interface AddEditSheetProps {
  repo: AddEditRepo;
  /** null = closed. */
  editor: Editor | null;
  onClose: () => void;
}

const FORM_ID = 'word-form';
/** Canvas N4: the "saved" toast shows for about 2 s. */
export const TOAST_MS = 2000;

/** The card's word and lists as a form draft, keeping the entry ids. */
function draftOf(card: CardWithEntries): CardDraft {
  const items = (entries: CardWithEntries['synonyms']) =>
    entries.map(({ id, text }) => ({ id, text }));
  return {
    word: card.card.word,
    synonyms: items(card.synonyms),
    meanings: items(card.meanings),
    sentences: items(card.sentences),
  };
}

/** The form as it starts: empty, or filled (editing; or a word already in the deck). */
interface FormState {
  /** Changing it starts a fresh form. */
  key: number;
  initial?: CardDraft;
  /** The word is already in this deck: Save becomes "Save & start over" (canvas N5). */
  duplicateOf?: { cardId: string; word: string };
  /** After a save the cursor goes back to the word field (canvas N4). */
  focusWord: boolean;
}

const EMPTY: FormState = { key: 0, focusWord: false };

/**
 * Add word / Edit word bottom sheet (PRD user flow 7–8; v3 brief 1.8, canvas N4 and N5).
 *
 * Adding stays open after Save: the fields clear, the cursor goes back to the word field and a
 * toast says "meticulous saved". It closes only with ✕, Esc or a drag down; there is no Done.
 * A word already in this deck shows a soft note, fills the form with the existing card (keeping
 * what was typed) and Save becomes "Save & start over": the card is updated, goes back to box 1
 * and counts as added today. "Add another word" empties the form; ✕ changes nothing.
 * The same word in another deck is not a duplicate.
 */
export function AddEditSheet({ repo, editor, onClose }: AddEditSheetProps) {
  const editingId = editor?.mode === 'edit' ? editor.cardId : null;
  const editing = useLiveQuery(
    async () => (editingId ? ((await repo.getCard(editingId)) ?? null) : null),
    [repo, editingId],
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState<FormState>(EMPTY);
  const [toast, setToast] = useState<{ id: number; message: ReactNode } | null>(null);
  const [savedOnce, setSavedOnce] = useState(false);
  const saving = useRef(false);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!editor) return null;
  // Wait for the card before showing the edit form, so it starts filled in.
  if (editor.mode === 'edit' && (!editing || editing.card.id !== editor.cardId)) return null;

  function close() {
    setErrors({});
    setForm(EMPTY);
    setToast(null);
    setSavedOnce(false);
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

  /** Empties the form for the next word; the cursor goes to the word field. */
  function freshForm(focusWord: boolean) {
    setErrors({});
    setForm((current) => ({ key: current.key + 1, focusWord }));
  }

  function showToast(message: ReactNode) {
    setToast((current) => ({ id: (current?.id ?? 0) + 1, message }));
  }

  /**
   * Is the typed word already in this deck? Then fill the form with that card plus what was
   * typed (canvas N5). Returns true when it was a duplicate.
   */
  async function checkDuplicate(deck: Deck, typed: CardDraft): Promise<boolean> {
    if (!typed.word.trim()) return false;
    if (form.duplicateOf && wordKey(form.duplicateOf.word) === wordKey(typed.word)) return true;
    const existingId = await repo.findCardIdByWord(typed.word, deck.id);
    const existing = existingId ? await repo.getCard(existingId) : undefined;
    if (!existing) {
      // The word was changed away from a duplicate: back to a normal new word.
      if (form.duplicateOf) setForm((current) => ({ ...current, duplicateOf: undefined }));
      return false;
    }
    setErrors({});
    setForm((current) => ({
      key: current.key + 1,
      initial: mergeTypedIntoCard(draftOf(existing), typed),
      duplicateOf: { cardId: existing.card.id, word: typed.word.trim() },
      focusWord: false,
    }));
    return true;
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

      const sameWord =
        form.duplicateOf !== undefined && wordKey(form.duplicateOf.word) === wordKey(draft.word);
      if (sameWord) {
        const result = await repo.saveAndStartOver(form.duplicateOf!.cardId, draft);
        if (result.status === 'invalid') return setErrors(result.errors);
        showToast(updatedMessage(draft.word));
        setSavedOnce(true);
        freshForm(true);
        return;
      }
      // Not checked yet (Save straight from the word field): check first, change nothing.
      if (await checkDuplicate(editor.deck, draft)) return;

      const result = await repo.addCard(draft, editor.deck.id);
      if (result.status === 'invalid') return setErrors(result.errors);
      // 'duplicate': added on another device a moment ago; the card is back at the start.
      showToast(
        result.status === 'duplicate' ? updatedMessage(draft.word) : savedMessage(draft.word),
      );
      setSavedOnce(true);
      freshForm(true);
    } finally {
      saving.current = false;
    }
  }

  const isEdit = editor.mode === 'edit';
  const duplicate = !isEdit && form.duplicateOf !== undefined;
  return (
    <Sheet
      open
      onClose={close}
      title={isEdit ? 'Edit word' : 'New word'}
      titleAddon={isEdit ? undefined : <DeckChip deck={editor.deck} />}
      mascot={isEdit ? <Mascot pose="write" size="small" decorative /> : undefined}
      closeOnOverlay={isEdit}
      toast={<Toast messageId={toast?.id}>{toast?.message ?? null}</Toast>}
    >
      {isEdit && <p className={styles.note}>Editing won't change when you see this word next.</p>}
      <WordForm
        key={isEdit ? editor.cardId : form.key}
        id={FORM_ID}
        mode={editor.mode}
        initial={isEdit ? draftOf(editing!) : form.initial}
        errors={errors}
        onClearError={clearError}
        onSubmit={(draft) => void save(draft)}
        onWordBlur={isEdit ? undefined : (draft) => void checkDuplicate(editor.deck, draft)}
        focusWord={!isEdit && form.focusWord}
        wordPlaceholder={!isEdit && savedOnce ? 'Type the next word' : undefined}
        wordNote={
          duplicate && (
            <div role="status" className={styles.duplicate}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 11v6M12 7h.01" />
              </svg>
              <span className={styles.duplicateText}>Already in your {editor.deck.label} box</span>
              <button type="button" className={styles.another} onClick={() => freshForm(true)}>
                Add another word
              </button>
            </div>
          )
        }
      />
      {/* At the end of the form, scrolling with it (not pinned; Yali, 2026-10-29). */}
      <Button type="submit" form={FORM_ID} className={styles.save}>
        {isEdit ? 'Save changes' : duplicate ? 'Save & start over' : 'Save word'}
      </Button>
      {duplicate && <p className={styles.startOver}>It goes back to the start of your box.</p>}
    </Sheet>
  );
}

function savedMessage(word: string): ReactNode {
  return (
    <>
      <b>{word.trim()}</b> saved
    </>
  );
}

function updatedMessage(word: string): ReactNode {
  return (
    <>
      <b>{word.trim()}</b> updated · back to the start
    </>
  );
}
