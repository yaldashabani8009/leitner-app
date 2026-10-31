import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Repository } from '../../data/repository';
import type { Deck } from '../../domain/decks/decks';
import { chipKind, splitWords, tidyPiece, type ChipKind } from '../../domain/spelling/words';
import { Button } from '../../ui/Button';
import { DeckChip } from '../../ui/DeckChip';
import { CloseIcon } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import { Toast } from '../../ui/Toast';
import { TOAST_MS } from './AddEditSheet';
import styles from './SpellingAddSheet.module.css';

type SpellingRepo = Pick<Repository, 'addSpellingWords' | 'spellingKeys'>;

interface SpellingAddSheetProps {
  repo: SpellingRepo;
  deck: Deck;
  onClose: () => void;
}

interface Chip {
  key: number;
  word: string;
}

let nextChip = 0;
const chipsOf = (words: readonly string[]): Chip[] =>
  words.map((word) => ({ key: (nextChip += 1), word }));

/**
 * Adding spelling words (v3 brief 1.2, canvas P3–P4). One big box takes a list (new lines,
 * commas, a Live Text paste); Check turns it into chips: plain = new, greyed = already in
 * Spelling (skipped), dashed = looks odd (still saved unless removed). Tap a chip to fix it,
 * ✕ to drop it. "Save N words" saves them all at once; the sheet stays open for the next list.
 */
export function SpellingAddSheet({ repo, deck, onClose }: SpellingAddSheetProps) {
  const [text, setText] = useState('');
  const [chips, setChips] = useState<Chip[] | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [toast, setToast] = useState<{ id: number; message: ReactNode } | null>(null);
  const existing = useLiveQuery(() => repo.spellingKeys(), [repo]);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const saving = useRef(false);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const known = existing ?? new Set<string>();
  const kinds = (chips ?? []).map((chip) => chipKind(chip.word, known));
  const toSave = (chips ?? []).filter((_, i) => kinds[i] !== 'already');

  function check() {
    const words = splitWords(text);
    if (words.length > 0) setChips(chipsOf(words));
  }

  function backToText() {
    setText((chips ?? []).map((chip) => chip.word).join('\n'));
    setChips(null);
    setEditing(null);
  }

  function fix(key: number, value: string) {
    const word = tidyPiece(value);
    setChips((current) =>
      (current ?? [])
        .map((chip) => (chip.key === key ? { ...chip, word } : chip))
        .filter((chip) => chip.word !== ''),
    );
    setEditing(null);
  }

  async function save() {
    if (saving.current || toSave.length === 0) return;
    saving.current = true;
    try {
      const { saved } = await repo.addSpellingWords(toSave.map((chip) => chip.word));
      setToast((current) => ({ id: (current?.id ?? 0) + 1, message: `${saved} saved` }));
      setChips(null);
      setText('');
      // The box empties and gets the cursor again, ready for the next list.
      setTimeout(() => boxRef.current?.focus(), 0);
    } finally {
      saving.current = false;
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="New words"
      titleAddon={<DeckChip deck={deck} />}
      closeOnOverlay={false}
      toast={<Toast messageId={toast?.id}>{toast?.message ?? null}</Toast>}
    >
      {chips === null ? (
        <>
          <div className={styles.field}>
            <label htmlFor="spelling-words" className={styles.label}>
              Words
            </label>
            <textarea
              id="spelling-words"
              ref={boxRef}
              className={styles.box}
              value={text}
              onChange={(event) => setText(event.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              aria-describedby="spelling-words-help"
            />
            <p id="spelling-words-help" className={styles.help}>
              One per line, or separated by commas. Paste from Live Text works too.
            </p>
          </div>
          <Button variant="aquaDark" className={styles.main} onClick={check}>
            Check
          </Button>
        </>
      ) : (
        <>
          <p className={`${styles.help} ${styles.helpCheck}`}>
            Tap a word to fix it, or ✕ to drop it.
          </p>
          <ul className={styles.chips} aria-label="Words to save">
            {chips.map((chip, index) => (
              <WordChip
                key={chip.key}
                word={chip.word}
                kind={kinds[index]}
                editing={editing === chip.key}
                onEdit={() => setEditing(chip.key)}
                onFix={(value) => fix(chip.key, value)}
                onRemove={() => setChips(chips.filter((other) => other.key !== chip.key))}
              />
            ))}
          </ul>
          <div className={styles.legend}>
            <p>
              <span className={`${styles.swatch} ${styles.alreadySwatch}`} aria-hidden="true" />
              Already in your Spelling box: skipped
            </p>
            <p>
              <span className={`${styles.swatch} ${styles.oddSwatch}`} aria-hidden="true" />
              Looks odd (numbers, Persian, 4+ words): check it
            </p>
          </div>
          {toSave.length > 0 ? (
            <Button variant="aquaDark" className={styles.main} onClick={() => void save()}>
              {toSave.length === 1 ? 'Save 1 word' : `Save ${toSave.length} words`}
            </Button>
          ) : (
            <p className={styles.nothing}>All of these are already in your Spelling box.</p>
          )}
          <button type="button" className={styles.back} onClick={backToText}>
            Back to the text
          </button>
        </>
      )}
    </Sheet>
  );
}

interface WordChipProps {
  word: string;
  kind: ChipKind;
  editing: boolean;
  onEdit: () => void;
  onFix: (value: string) => void;
  onRemove: () => void;
}

/** One checked word (P4): plain, greyed "· already there" (no ✕), or dashed "looks odd". */
function WordChip({ word, kind, editing, onEdit, onFix, onRemove }: WordChipProps) {
  const persian = /[؀-ۿ]/.test(word);
  if (kind === 'already') {
    return <li className={`${styles.chip} ${styles.already}`}>{word} · already there</li>;
  }
  return (
    <li className={`${styles.chip} ${kind === 'odd' ? styles.odd : ''}`}>
      {editing ? (
        <input
          className={styles.edit}
          defaultValue={word}
          aria-label={`Fix ${word}`}
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onBlur={(event) => onFix(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onFix(event.currentTarget.value);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className={styles.word}
          lang={persian ? 'fa' : undefined}
          aria-label={kind === 'odd' ? `${word}, looks odd, tap to fix` : `${word}, tap to fix`}
          onClick={onEdit}
        >
          {word}
        </button>
      )}
      <button
        type="button"
        className={styles.remove}
        aria-label={`Remove ${word}`}
        onClick={onRemove}
      >
        <CloseIcon size={14} />
      </button>
    </li>
  );
}
