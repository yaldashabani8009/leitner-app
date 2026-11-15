import { useState } from 'react';
import type { CardWithEntries } from '../../data/repository';
import { FitText } from '../../ui/FitText';
import { IconButton } from '../../ui/IconButton';
import { PencilIcon } from '../../ui/icons';
import { Pill } from '../../ui/Pill';
import styles from './CardBack.module.css';

/**
 * The answer side of a card: the word, similar words, Persian and sentences (canvas 03).
 * Phrases (canvas P9, P10): no similar words; only the parts that exist, with no empty slots;
 * with neither Persian nor a sentence, the phrase again in the middle and "No meaning yet".
 */
export function CardBack({ card, onEdit }: { card: CardWithEntries; onEdit?: () => void }) {
  const word = card.card.word;
  const phrase = card.card.deck === 'phrases';
  const pencil = onEdit && (
    <IconButton
      label={phrase ? 'Edit phrase' : 'Edit word'}
      variant="cream"
      icon={<PencilIcon />}
      onClick={onEdit}
      aria-keyshortcuts="E"
    />
  );

  if (phrase && card.meanings.length === 0 && card.sentences.length === 0) {
    return (
      <div className={styles.empty}>
        {pencil && <div className={styles.emptyPencil}>{pencil}</div>}
        <h1 className={styles.emptyPhrase}>
          <FitText className={styles.backWordText} text={word} max={36} min={22} />
        </h1>
        <p className={styles.emptyLine}>No meaning yet</p>
      </div>
    );
  }

  return (
    <>
      <div className={styles.backHeader}>
        <h1 className={styles.backWord}>
          <FitText className={styles.backWordText} text={word} max={28} min={20} />
        </h1>
        {pencil}
      </div>
      {!phrase && (
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
      )}
      {card.meanings.length > 0 && (
        <section className={styles.section} aria-label="In Persian">
          <h2 className={styles.label}>in Persian</h2>
          {/* One chip per meaning, like the similar words (Yali, 2026-11-09). */}
          <ul lang="fa" dir="rtl" className={styles.persian}>
            {card.meanings.map((entry) => (
              <li
                key={entry.id}
                className={`${styles.persianChip} ${phrase ? styles.persianChipPhrase : ''}`}
              >
                {entry.text}
              </li>
            ))}
          </ul>
        </section>
      )}
      {card.sentences.length > 0 && (
        <section className={styles.section} aria-label="In a sentence">
          <h2 className={styles.label}>in a sentence</h2>
          {card.sentences.map((entry) =>
            entry.translation ? (
              <SentenceWithPersian
                key={entry.id}
                text={entry.text}
                translation={entry.translation}
                word={word}
                phrase={phrase}
              />
            ) : (
              <p key={entry.id} className={`${styles.sentence} ${styles.plainSentence}`}>
                “<Highlight text={entry.text} word={word} phrase={phrase} />”
              </p>
            ),
          )}
        </section>
      )}
    </>
  );
}

interface SentenceWithPersianProps {
  text: string;
  translation: string;
  word: string;
  phrase: boolean;
}

/**
 * A sentence with its Persian hidden at first (v3 step 4, canvas P2): a soft "fa" pill says one
 * exists; tapping the sentence shows it underneath on a pale background, tapping again hides it.
 * A real button (Tab, Enter, Space). It never flips the card or answers it; a tap is not a swipe
 * (the swipe ignores taps, filterTaps), so only a real drag moves the card.
 * Every card starts hidden again: the card back is drawn fresh for each card.
 */
function SentenceWithPersian({ text, translation, word, phrase }: SentenceWithPersianProps) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      className={`${styles.sentenceButton} ${open ? styles.revealed : ''}`}
      aria-expanded={open}
      aria-label={open ? undefined : `${text}. Persian translation hidden, tap to show`}
      onClick={(event) => {
        event.stopPropagation();
        setOpen((shown) => !shown);
      }}
    >
      <span className={styles.sentenceLine}>
        <span className={styles.sentence}>
          “<Highlight text={text} word={word} phrase={phrase} />”
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

/** Marks the card's word inside a sentence (canvas: soft cream highlight; pale terracotta for a phrase, P9). */
export function Highlight({
  text,
  word,
  phrase = false,
}: {
  text: string;
  word: string;
  phrase?: boolean;
}) {
  const needle = word.trim();
  if (!needle) return <>{text}</>;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === needle.toLowerCase() ? (
          <mark key={i} className={`${styles.mark} ${phrase ? styles.markPhrase : ''}`}>
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
