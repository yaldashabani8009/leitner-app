import { useState } from 'react';
import type { CardWithEntries } from '../../data/repository';
import { IconButton } from '../../ui/IconButton';
import { PencilIcon } from '../../ui/icons';
import { Pill } from '../../ui/Pill';
import styles from './CardBack.module.css';

/** The answer side of a card: the word, similar words, Persian and sentences (canvas 03). */
export function CardBack({ card, onEdit }: { card: CardWithEntries; onEdit?: () => void }) {
  const word = card.card.word;
  return (
    <>
      <div className={styles.backHeader}>
        <h1 className={styles.backWord}>{word}</h1>
        {onEdit && (
          <IconButton
            label="Edit word"
            variant="cream"
            icon={<PencilIcon />}
            onClick={onEdit}
            aria-keyshortcuts="E"
          />
        )}
      </div>
      <section className={styles.section} aria-label="Similar words">
        <h2 className={styles.label}>similar words</h2>
        <div className={styles.tags}>
          {card.synonyms.map((entry) => (
            <Pill key={entry.id} variant="tag">
              {entry.text}
            </Pill>
          ))}
        </div>
      </section>
      <section className={styles.section} aria-label="In Persian">
        <h2 className={styles.label}>in Persian</h2>
        <div lang="fa" className={styles.persian}>
          {card.meanings.map((entry) => (
            <p key={entry.id}>{entry.text}</p>
          ))}
        </div>
      </section>
      <section className={styles.section} aria-label="In a sentence">
        <h2 className={styles.label}>in a sentence</h2>
        {card.sentences.map((entry) =>
          entry.translation ? (
            <SentenceWithPersian
              key={entry.id}
              text={entry.text}
              translation={entry.translation}
              word={word}
            />
          ) : (
            <p key={entry.id} className={`${styles.sentence} ${styles.plainSentence}`}>
              “<Highlight text={entry.text} word={word} />”
            </p>
          ),
        )}
      </section>
    </>
  );
}

interface SentenceWithPersianProps {
  text: string;
  translation: string;
  word: string;
}

/**
 * A sentence with its Persian hidden at first (v3 step 4, canvas P2): a soft "fa" pill says one
 * exists; tapping the sentence shows it underneath on a pale background, tapping again hides it.
 * A real button (Tab, Enter, Space). It never flips the card, starts a swipe or answers it.
 * Every card starts hidden again: the card back is drawn fresh for each card.
 */
function SentenceWithPersian({ text, translation, word }: SentenceWithPersianProps) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      className={`${styles.sentenceButton} ${open ? styles.revealed : ''}`}
      aria-expanded={open}
      aria-label={open ? undefined : `${text}. Persian translation hidden, tap to show`}
      // Not the start of a swipe on the card back.
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        setOpen((shown) => !shown);
      }}
    >
      <span className={styles.sentenceLine}>
        <span className={styles.sentence}>
          “<Highlight text={text} word={word} />”
        </span>
        {!open && (
          <span className={styles.fa} aria-hidden="true">
            fa
          </span>
        )}
      </span>
      {open && (
        <span lang="fa" dir="rtl" className={styles.translation}>
          {translation}
        </span>
      )}
    </button>
  );
}

/** Marks the card's word inside a sentence (canvas: soft cream highlight). */
export function Highlight({ text, word }: { text: string; word: string }) {
  const needle = word.trim();
  if (!needle) return <>{text}</>;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === needle.toLowerCase() ? (
          <mark key={i} className={styles.mark}>
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
