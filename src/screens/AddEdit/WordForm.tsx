import { useId, useState, type FormEvent } from 'react';
import type { CardWithEntries } from '../../data/repository';
import { itemsFromText, joinList } from '../../domain/card/commaList';
import {
  type CardDraft,
  type CardField,
  type FieldErrors,
  type ListField,
} from '../../domain/card/validate';
import { IconButton } from '../../ui/IconButton';
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
}

interface WordFormProps {
  id: string;
  mode: 'add' | 'edit';
  /** Filled in when editing. */
  initial?: CardWithEntries;
  /** Errors from the last save; a field's error clears as soon as you change it. */
  errors: FieldErrors;
  onClearError: (field: CardField) => void;
  onSubmit: (draft: CardDraft) => void;
}

let nextKey = 0;
const newKey = () => `item-${(nextKey += 1)}`;

function startSentences(initial?: CardWithEntries): Item[] {
  const saved = initial?.sentences ?? [];
  return saved.length
    ? saved.map((entry) => ({ key: newKey(), id: entry.id, text: entry.text }))
    : [{ key: newKey(), text: '' }];
}

const texts = (entries: readonly { text: string }[] | undefined) =>
  (entries ?? []).map((entry) => entry.text);

/**
 * The add / edit form (canvas 09 / 10). Similar words and Persian meanings are one field each,
 * split by "," or "،" (Yali, 2026-10-29); sentences stay one field per sentence (they contain
 * commas), with "+ sentence" right under them and a ✕ in edit mode while there is more than one.
 */
export function WordForm({ id, mode, initial, errors, onClearError, onSubmit }: WordFormProps) {
  const [word, setWord] = useState(initial?.card.word ?? '');
  const [synonyms, setSynonyms] = useState(() => joinList(texts(initial?.synonyms)));
  const [meanings, setMeanings] = useState(() => joinList(texts(initial?.meanings), true));
  const [sentences, setSentences] = useState<Item[]>(() => startSentences(initial));
  const [focusKey, setFocusKey] = useState<string | null>(null);

  function updateSentences(next: Item[]) {
    setSentences(next);
    onClearError('sentences');
  }

  function addSentence() {
    const item = { key: newKey(), text: '' };
    updateSentences([...sentences, item]);
    setFocusKey(item.key);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({
      word,
      synonyms: itemsFromText(synonyms, initial?.synonyms),
      meanings: itemsFromText(meanings, initial?.meanings),
      sentences: sentences.map(({ id: entryId, text }) => ({ id: entryId, text })),
    });
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
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="next"
      />

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

      <ListGroup
        field="sentences"
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

interface ListGroupProps {
  field: ListField;
  items: Item[];
  error?: string;
  removable: boolean;
  inputRef: (key: string, element: HTMLInputElement | HTMLTextAreaElement | null) => void;
  onChange: (items: Item[]) => void;
}

/** One list (similar words, Persian, sentences): a label, one input per item, the error below. */
function ListGroup({ field, items, error, removable, inputRef, onChange }: ListGroupProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const words = LISTS[field];

  return (
    <div className={fieldStyles.field}>
      <label htmlFor={`${id}-0`} className={fieldStyles.label}>
        {words.label}
      </label>
      {items.map((item, index) => (
        <div key={item.key} className={styles.itemRow}>
          <Input
            multiline={field === 'sentences'}
            id={`${id}-${index}`}
            inputRef={(element) => inputRef(item.key, element)}
            className={[fieldStyles.input, index > 0 && !item.text && styles.extraEmpty]
              .filter(Boolean)
              .join(' ')}
            value={item.text}
            lang={words.lang}
            aria-label={index > 0 ? `${words.one} ${index + 1}` : undefined}
            placeholder={
              index > 0 ? (words.lang ? words.placeholder : 'another one?') : words.placeholder
            }
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            autoComplete="off"
            onText={(text) =>
              onChange(items.map((other) => (other.key === item.key ? { ...other, text } : other)))
            }
          />
          {removable && (
            <IconButton
              label={`Remove ${words.one.toLowerCase()} ${index + 1}`}
              variant="white"
              icon={<CloseIcon />}
              onClick={() => onChange(items.filter((other) => other.key !== item.key))}
            />
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
