import { useId, useRef, useState, type FormEvent, type Ref } from 'react';
import type { CardWithEntries } from '../../data/repository';
import {
  LIST_FIELDS,
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

type Lists = Record<ListField, Item[]>;

interface WordFormProps {
  id: string;
  mode: 'add' | 'edit';
  /** Filled in when editing. */
  initial?: CardWithEntries;
  /** Errors from the last save; a field's error clears as soon as you change it. */
  errors: FieldErrors;
  onClearError: (field: CardField) => void;
  onSubmit: (draft: CardDraft) => void;
  /** Gets the word input, so the sheet can focus it when it opens. */
  wordRef?: Ref<HTMLInputElement>;
}

let nextKey = 0;
const newKey = () => `item-${(nextKey += 1)}`;

function startLists(initial?: CardWithEntries): Lists {
  const lists = {} as Lists;
  for (const field of LIST_FIELDS) {
    const saved = initial?.[field] ?? [];
    lists[field] = saved.length
      ? saved.map((entry) => ({ key: newKey(), id: entry.id, text: entry.text }))
      : [{ key: newKey(), text: '' }];
  }
  return lists;
}

/**
 * The add / edit form (canvas 09 / 10). The Save button lives in the sheet footer and submits
 * this form by its id. Empty extra fields are ignored on save; in edit mode each list item
 * also gets a ✕ while the list has more than one (decided 2026-10-29).
 */
export function WordForm({
  id,
  mode,
  initial,
  errors,
  onClearError,
  onSubmit,
  wordRef,
}: WordFormProps) {
  const [word, setWord] = useState(initial?.card.word ?? '');
  const [lists, setLists] = useState<Lists>(() => startLists(initial));
  const inputs = useRef(new Map<string, HTMLInputElement | HTMLTextAreaElement>());
  const [focusKey, setFocusKey] = useState<string | null>(null);

  function update(field: ListField, next: Item[]) {
    setLists((current) => ({ ...current, [field]: next }));
    onClearError(field);
  }

  function addItem(field: ListField) {
    const item = { key: newKey(), text: '' };
    update(field, [...lists[field], item]);
    setFocusKey(item.key);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({
      word,
      synonyms: lists.synonyms.map(({ id: entryId, text }) => ({ id: entryId, text })),
      meanings: lists.meanings.map(({ id: entryId, text }) => ({ id: entryId, text })),
      sentences: lists.sentences.map(({ id: entryId, text }) => ({ id: entryId, text })),
    });
  }

  return (
    <form id={id} className={styles.form} onSubmit={handleSubmit} noValidate>
      <TextField
        ref={wordRef}
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

      {LIST_FIELDS.map((field) => (
        <ListGroup
          key={field}
          field={field}
          items={lists[field]}
          error={errors[field] && errorText(field, errors[field])}
          removable={mode === 'edit' && lists[field].length > 1}
          inputRef={(key, element) => {
            if (element) {
              inputs.current.set(key, element);
              if (key === focusKey) {
                element.focus();
                setFocusKey(null);
              }
            } else {
              inputs.current.delete(key);
            }
          }}
          onChange={(next) => update(field, next)}
        />
      ))}

      <div className={styles.addRow}>
        {LIST_FIELDS.map((field) => (
          <AddPill key={field} onClick={() => addItem(field)}>
            {LISTS[field].add}
          </AddPill>
        ))}
      </div>
    </form>
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
      {error && (
        <p id={errorId} className={fieldStyles.error}>
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
          {error}
        </p>
      )}
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
