import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { itemsFromText, joinList } from '../../domain/card/commaList';
import { type CardDraft, type CardField, type FieldErrors } from '../../domain/card/validate';
import { CloseIcon } from '../../ui/icons';
import { AddPill } from '../../ui/Pill';
import { TextField } from '../../ui/TextField';
import fieldStyles from '../../ui/TextField.module.css';
import { errorText, LISTS } from './messages';
import styles from './WordForm.module.css';

interface Item {
  /** Stable React key, also for new items. */
  key: string;
  /** The saved entry's id when editing (so edits keep it, ADR-003). */
  id?: string;
  text: string;
  /** Sentences only: the optional Persian under it (v3 step 4). */
  translation?: string;
}

interface WordFormProps {
  id: string;
  mode: 'add' | 'edit';
  /** Filled in when editing, or with the existing card plus what was typed (canvas N5). */
  initial?: CardDraft;
  /** Errors from the last save; a field's error clears as soon as you change it. */
  errors: FieldErrors;
  onClearError: (field: CardField) => void;
  onSubmit: (draft: CardDraft) => void;
  /** Leaving the word field: the add sheet checks for the word in this deck (canvas N5). */
  onWordBlur?: (draft: CardDraft) => void;
  /** Under the word field, e.g. "Already in your Vocab box". */
  wordNote?: ReactNode;
  /** Put the cursor in the word field (after a save, so the next word can be typed; N4). */
  focusWord?: boolean;
  wordPlaceholder?: string;
  /** A spelling card: the word is the whole card (v3 brief 1.2: one field, "The word"). */
  wordOnly?: boolean;
}

let nextKey = 0;
const newKey = () => `item-${(nextKey += 1)}`;

function startSentences(initial?: CardDraft): Item[] {
  const saved = initial?.sentences ?? [];
  return saved.length
    ? saved.map((entry) => ({
        key: newKey(),
        id: entry.id,
        text: entry.text,
        translation: entry.translation ?? '',
      }))
    : [{ key: newKey(), text: '', translation: '' }];
}

const texts = (entries: readonly { text: string }[] | undefined) =>
  (entries ?? []).map((entry) => entry.text);

/** Saved items (with an id) of a list, so unchanged text keeps its id on save. */
const saved = (entries: readonly { id?: string; text: string }[] | undefined) =>
  (entries ?? []).filter((entry): entry is { id: string; text: string } => entry.id !== undefined);

/**
 * The add / edit form (canvas 09 / 10). Similar words and Persian meanings are one field each,
 * split by "," or "،" (Yali, 2026-10-29); sentences stay one field per sentence (they contain
 * commas), with "+ sentence" right under them and a ✕ in edit mode while there is more than one.
 */
export function WordForm({
  id,
  mode,
  initial,
  errors,
  onClearError,
  onSubmit,
  onWordBlur,
  wordNote,
  focusWord = false,
  wordPlaceholder,
  wordOnly = false,
}: WordFormProps) {
  const [word, setWord] = useState(initial?.word ?? '');
  const wordRef = useRef<HTMLInputElement>(null);
  // Only when the form appears (it is remounted after each save); never while typing elsewhere.
  useEffect(() => {
    if (focusWord) wordRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [synonyms, setSynonyms] = useState(() => joinList(texts(initial?.synonyms)));
  const [meanings, setMeanings] = useState(() => joinList(texts(initial?.meanings), true));
  const [sentences, setSentences] = useState<Item[]>(() => startSentences(initial));
  const [focusKey, setFocusKey] = useState<string | null>(null);

  function updateSentences(next: Item[]) {
    setSentences(next);
    onClearError('sentences');
  }

  function addSentence() {
    const item = { key: newKey(), text: '', translation: '' };
    updateSentences([...sentences, item]);
    setFocusKey(item.key);
  }

  function draft(): CardDraft {
    return {
      word,
      synonyms: itemsFromText(synonyms, saved(initial?.synonyms)),
      meanings: itemsFromText(meanings, saved(initial?.meanings)),
      sentences: sentences.map(({ id: entryId, text, translation }) => ({
        id: entryId,
        text,
        translation: translation ?? '',
      })),
    };
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(draft());
  }

  return (
    <form id={id} className={styles.form} onSubmit={handleSubmit} noValidate>
      <TextField
        label="The word"
        value={word}
        onChange={(event) => {
          setWord(event.target.value);
          onClearError('word');
        }}
        error={errors.word && errorText('word', errors.word)}
        note={wordNote}
        onBlur={onWordBlur ? () => onWordBlur(draft()) : undefined}
        ref={wordRef}
        placeholder={wordPlaceholder}
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="next"
      />

      {!wordOnly && (
        <>
          <CommaField
            field="synonyms"
            value={synonyms}
            error={errors.synonyms && errorText('synonyms', errors.synonyms)}
            onChange={(text) => {
              setSynonyms(text);
              onClearError('synonyms');
            }}
          />

          <CommaField
            field="meanings"
            value={meanings}
            error={errors.meanings && errorText('meanings', errors.meanings)}
            onChange={(text) => {
              setMeanings(text);
              onClearError('meanings');
            }}
          />

          <SentenceGroup
            items={sentences}
            error={errors.sentences && errorText('sentences', errors.sentences)}
            removable={mode === 'edit' && sentences.length > 1}
            inputRef={(key, element) => {
              if (element && key === focusKey) {
                element.focus();
                setFocusKey(null);
              }
            }}
            onChange={updateSentences}
          />
          <div className={styles.addRow}>
            <AddPill onClick={addSentence}>{LISTS.sentences.add}</AddPill>
          </div>
        </>
      )}
    </form>
  );
}

interface CommaFieldProps {
  field: 'synonyms' | 'meanings';
  value: string;
  error?: string;
  onChange: (text: string) => void;
}

/** One field for a whole list: "careful, precise" (or "دقیق، وسواسی"). Grows with the text. */
function CommaField({ field, value, error, onChange }: CommaFieldProps) {
  const id = useId();
  const words = LISTS[field];
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className={fieldStyles.field}>
      <label htmlFor={id} className={fieldStyles.label}>
        {words.label}
      </label>
      <Input
        multiline
        id={id}
        inputRef={() => {}}
        className={fieldStyles.input}
        value={value}
        lang={words.lang}
        placeholder={words.placeholder}
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        onText={onChange}
      />
      <p id={hintId} className={styles.hint}>
        {words.hint}
      </p>
      {error && <FieldError id={errorId} text={error} />}
    </div>
  );
}

function FieldError({ id, text }: { id: string; text: string }) {
  return (
    <p id={id} className={fieldStyles.error}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={fieldStyles.icon}
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 7v6M12 17h.01" />
      </svg>
      {text}
    </p>
  );
}

interface SentenceGroupProps {
  items: Item[];
  error?: string;
  removable: boolean;
  inputRef: (key: string, element: HTMLInputElement | HTMLTextAreaElement | null) => void;
  onChange: (items: Item[]) => void;
}

/**
 * "In a sentence" (canvas P1): each sentence with a smaller right-to-left "Persian (optional)"
 * field under it; the ✕ beside a pair removes both. "+ sentence" adds a pair.
 */
function SentenceGroup({ items, error, removable, inputRef, onChange }: SentenceGroupProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const change = (key: string, part: Partial<Item>) =>
    onChange(items.map((item) => (item.key === key ? { ...item, ...part } : item)));
  return (
    <div className={fieldStyles.field} role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className={fieldStyles.label}>
        {LISTS.sentences.label}
      </span>
      {items.map((item, index) => (
        <div key={item.key} className={styles.pairRow}>
          <div className={styles.pair}>
            <Input
              multiline
              id={`${id}-${index}`}
              inputRef={(element) => inputRef(item.key, element)}
              className={`${fieldStyles.input} ${styles.sentenceInput}`}
              value={item.text}
              aria-label={`Sentence ${index + 1}`}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              autoComplete="off"
              onText={(text) => change(item.key, { text })}
            />
            <Input
              multiline
              id={`${id}-${index}-fa`}
              inputRef={() => {}}
              lang="fa"
              className={styles.persianField}
              value={item.translation ?? ''}
              placeholder="Persian (optional)"
              aria-label={`Persian for sentence ${index + 1} (optional)`}
              autoComplete="off"
              onText={(translation) => change(item.key, { translation })}
            />
          </div>
          {removable && (
            <button
              type="button"
              className={styles.removePair}
              aria-label={`Remove sentence ${index + 1}`}
              onClick={() => onChange(items.filter((other) => other.key !== item.key))}
            >
              <CloseIcon size={16} />
            </button>
          )}
        </div>
      ))}
      {error && <FieldError id={errorId} text={error} />}
    </div>
  );
}

interface InputProps {
  multiline: boolean;
  id: string;
  inputRef: (element: HTMLInputElement | HTMLTextAreaElement | null) => void;
  className: string;
  value: string;
  lang?: string;
  placeholder?: string;
  autoComplete: string;
  onText: (text: string) => void;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/**
 * One list item. Sentences use a text area that grows with the text, so a long sentence
 * stays readable; Enter doesn't add a line break (a sentence is one line of text).
 */
function Input({ multiline, inputRef, onText, ...props }: InputProps) {
  if (!multiline) {
    return <input ref={inputRef} onChange={(event) => onText(event.target.value)} {...props} />;
  }
  const grow = (element: HTMLTextAreaElement) => {
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  };
  return (
    <textarea
      ref={(element) => {
        inputRef(element);
        if (element) grow(element);
      }}
      rows={1}
      enterKeyHint="done"
      onChange={(event) => {
        grow(event.target);
        onText(event.target.value.replace(/\n/g, ' '));
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.preventDefault();
      }}
      {...props}
    />
  );
}
