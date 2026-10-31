import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  listItems,
  matchesSearch,
  progressLabel,
  type ListItem,
  type WordRow,
  type WordSort,
} from '../../domain/allWords/allWords';
import type { Deck } from '../../domain/decks/decks';
import type { DeckId } from '../../domain/leitner/config';
import { AddButton } from '../../ui/AddButton';
import { DeckIcon } from '../../ui/DeckIcon';
import { IconButton } from '../../ui/IconButton';
import { BackIcon, RetryIcon } from '../../ui/icons';
import { Mascot } from '../../ui/Mascot/Mascot';
import styles from './AllWordsScreen.module.css';

interface AllWordsScreenProps {
  /** Every live card; undefined while loading. */
  rows: readonly WordRow[] | undefined;
  /** The enabled decks, for the chips. */
  decks: readonly Deck[];
  /** Today in the profile time zone, for the day headings. */
  today: string;
  onBack: () => void;
  onAdd: (deck: Deck) => void;
  /** Tap a row: the card view, which has Edit. */
  onOpenCard: (cardId: string) => void;
  onDelete: (row: WordRow) => void;
  /** A day heading's Practice: extra practice of the cards added that day in these decks. */
  onPracticeDay: (day: string, decks: readonly DeckId[]) => void;
  /** The toast after a delete, with Undo (canvas N10). */
  toast?: ReactNode;
}

const SORTS: { id: WordSort; label: string }[] = [
  { id: 'day', label: 'By day' },
  { id: 'az', label: 'A–Z' },
  { id: 'needsWork', label: 'Needs work' },
];

/** Fixed heights so the list can be virtualised (canvas N8: 14px padding, 18px word, 14px Persian). */
const ROW_HEIGHT = 56;
const ROW_WITH_MEANING_HEIGHT = 76;
const HEADING_HEIGHT = 40;
const HEADING_GAP = 22;
/** Rows drawn above and below what is visible, so fast scrolling never shows a gap. */
const OVERSCAN_PX = 600;
/** How much a row narrows to show Delete (canvas N9: a 100px button 8px from the row). */
const DELETE_SLIDE_PX = 108;

function itemHeight(item: ListItem, index: number): number {
  if (item.kind === 'heading') return HEADING_HEIGHT + (index === 0 ? 0 : HEADING_GAP);
  return item.row.meanings.length > 0 ? ROW_WITH_MEANING_HEIGHT : ROW_HEIGHT;
}

/**
 * "In your box" (v3 brief 1.9, canvas N8–N10, L4), opened from the box badge.
 * Deck chips with counts, search (word and Persian), three sorts, progress dots (the only place
 * box progress shows), swipe left to delete with Undo. The list is virtualised, so it stays
 * smooth with thousands of words, and reads only the device, so it works offline.
 */
export function AllWordsScreen({
  rows,
  decks,
  today,
  onBack,
  onAdd,
  onOpenCard,
  onDelete,
  onPracticeDay,
  toast,
}: AllWordsScreenProps) {
  const [deckFilter, setDeckFilter] = useState<DeckId | 'all'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<WordSort>('day');
  const [sortOpen, setSortOpen] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);

  const total = rows?.length ?? 0;
  const items = useMemo(() => {
    const shown = (rows ?? []).filter(
      (row) => (deckFilter === 'all' || row.deck === deckFilter) && matchesSearch(row, query),
    );
    return listItems(shown, sort, today);
  }, [rows, deckFilter, query, sort, today]);

  const filterDecks: readonly DeckId[] =
    deckFilter === 'all' ? decks.map((deck) => deck.id) : [deckFilter];

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <IconButton
          label="Back"
          variant="white"
          icon={<BackIcon size={20} />}
          onClick={onBack}
          className={styles.back}
        />
        <div className={styles.heading}>
          <h1 className={styles.title}>In your box</h1>
          {rows !== undefined && (
            <span className={styles.total}>{total === 1 ? '1 card' : `${total} cards`}</span>
          )}
        </div>
        <AddButton decks={decks} onPick={onAdd} />
      </header>

      {rows !== undefined && rows.length === 0 ? (
        <div className={styles.empty}>
          <Mascot pose="idle" decorative />
          <p className={styles.emptyTitle}>Your box is empty</p>
        </div>
      ) : (
        <>
          <DeckChips
            decks={decks}
            rows={rows ?? []}
            selected={deckFilter}
            onSelect={setDeckFilter}
          />

          <div className={styles.tools}>
            <label className={styles.search}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-4-4" />
              </svg>
              <input
                type="search"
                aria-label="Search words"
                placeholder="Search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                data-search
              />
            </label>
            <div className={styles.sortWrap}>
              <button
                type="button"
                className={`${styles.sort} ${sortOpen ? styles.sortOpen : ''}`}
                aria-label={`Sort: ${SORTS.find((s) => s.id === sort)!.label.toLowerCase()}`}
                aria-haspopup="menu"
                aria-expanded={sortOpen}
                onClick={() => setSortOpen((open) => !open)}
              >
                {SORTS.find((s) => s.id === sort)!.label}
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path d={sortOpen ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
                </svg>
              </button>
              {sortOpen && (
                <div role="menu" aria-label="Sort" className={styles.sortMenu}>
                  {SORTS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={option.id === sort}
                      className={styles.sortItem}
                      onClick={() => {
                        setSort(option.id);
                        setSortOpen(false);
                      }}
                    >
                      {option.label}
                      {option.id === sort && (
                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <VirtualList
            items={items}
            renderItem={(item, index) =>
              item.kind === 'heading' ? (
                <div className={`${styles.dayHeading} ${index === 0 ? styles.firstHeading : ''}`}>
                  <span className={styles.dayLabel}>{item.label}</span>
                  <button
                    type="button"
                    className={styles.practice}
                    aria-label={`Practice words added ${item.label === 'TODAY' ? 'today' : item.label === 'YESTERDAY' ? 'yesterday' : `on ${item.label}`}`}
                    onClick={() => onPracticeDay(item.day, filterDecks)}
                  >
                    <RetryIcon size={16} />
                    Practice
                  </button>
                </div>
              ) : (
                <WordRowView
                  row={item.row}
                  deck={
                    deckFilter === 'all' ? decks.find((d) => d.id === item.row.deck) : undefined
                  }
                  open={openRow === item.row.id}
                  onOpenChange={(open) => setOpenRow(open ? item.row.id : null)}
                  onTap={() => onOpenCard(item.row.id)}
                  onDelete={() => {
                    setOpenRow(null);
                    onDelete(item.row);
                  }}
                />
              )
            }
          />
          {rows !== undefined && items.length === 0 && (
            <p className={styles.noMatch}>No words match “{query.trim()}”.</p>
          )}
        </>
      )}
      {toast}
    </main>
  );
}

interface DeckChipsProps {
  decks: readonly Deck[];
  rows: readonly WordRow[];
  selected: DeckId | 'all';
  onSelect: (deck: DeckId | 'all') => void;
}

/**
 * All plus one chip per enabled deck, with counts (canvas N8). The row scrolls sideways with no
 * visible scrollbar; a chosen chip further right is scrolled fully into view (N9).
 */
function DeckChips({ decks, rows, selected, onSelect }: DeckChipsProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const chip = rowRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    chip?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [selected]);
  const count = (deck: DeckId) => rows.filter((row) => row.deck === deck).length;
  return (
    <div ref={rowRef} className={styles.chips} role="group" aria-label="Decks">
      <button
        type="button"
        aria-pressed={selected === 'all'}
        className={styles.chip}
        onClick={() => onSelect('all')}
      >
        All {rows.length}
      </button>
      {decks.map((deck) => (
        <button
          key={deck.id}
          type="button"
          aria-pressed={selected === deck.id}
          className={`${styles.chip} ${styles.deckChip}`}
          onClick={() => onSelect(deck.id)}
        >
          <DeckIcon icon={deck.icon} size={18} strokeWidth={2.2} />
          {deck.label} {count(deck.id)}
        </button>
      ))}
    </div>
  );
}

interface VirtualListProps {
  items: readonly ListItem[];
  renderItem: (item: ListItem, index: number) => ReactNode;
}

/** Draws only the rows near the visible part of the list (fixed row heights). */
function VirtualList({ items, renderItem }: VirtualListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(800);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setHeight(element.clientHeight || 800);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const tops: number[] = [];
  let total = 0;
  items.forEach((item, index) => {
    tops.push(total);
    total += itemHeight(item, index);
  });
  const from = scrollTop - OVERSCAN_PX;
  const to = scrollTop + height + OVERSCAN_PX;

  return (
    <div
      ref={ref}
      className={styles.scroller}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <ul className={styles.list} style={{ height: total }}>
        {items.map((item, index) => {
          const top = tops[index];
          const itemBottom = top + itemHeight(item, index);
          if (itemBottom < from || top > to) return null;
          return (
            <li
              key={item.kind === 'heading' ? `day-${item.day}` : item.row.id}
              className={styles.item}
              style={{ top, height: itemHeight(item, index) }}
            >
              {renderItem(item, index)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface WordRowViewProps {
  row: WordRow;
  /** Shown before the word on the All view only. */
  deck?: Deck;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTap: () => void;
  onDelete: () => void;
}

/** One word: no box around it, a thin divider, progress dots on the right (canvas N8, N9). */
function WordRowView({ row, deck, open, onOpenChange, onTap, onDelete }: WordRowViewProps) {
  const start = useRef<{ x: number; moved: boolean } | null>(null);

  function onPointerDown(event: ReactPointerEvent) {
    start.current = { x: event.clientX, moved: false };
  }
  function onPointerMove(event: ReactPointerEvent) {
    if (!start.current) return;
    const dx = event.clientX - start.current.x;
    if (dx < -40 && !open) {
      start.current.moved = true;
      onOpenChange(true);
    } else if (dx > 30 && open) {
      start.current.moved = true;
      onOpenChange(false);
    }
  }
  function onClick() {
    const moved = start.current?.moved;
    start.current = null;
    if (moved) return;
    if (open) onOpenChange(false);
    else onTap();
  }

  return (
    <div className={styles.rowWrap}>
      {open && (
        <button type="button" className={styles.delete} onClick={onDelete}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
          </svg>
          Delete
        </button>
      )}
      <button
        type="button"
        className={`${styles.row} ${open ? styles.rowOpen : ''}`}
        style={{ width: open ? `calc(100% - ${DELETE_SLIDE_PX}px)` : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onClick={onClick}
        onKeyDown={(event) => {
          // Keyboard and screen readers: Delete (or Backspace) shows the Delete button.
          if (event.key === 'Delete' || event.key === 'Backspace') {
            event.preventDefault();
            onOpenChange(true);
          } else if (event.key === 'Escape' && open) onOpenChange(false);
        }}
      >
        {deck && <DeckIcon icon={deck.icon} size={22} />}
        <span className={styles.words}>
          <span className={styles.word}>{row.word}</span>
          {row.meanings.length > 0 && (
            <span lang="fa" dir="rtl" className={styles.meaning}>
              {row.meanings.join('، ')}
            </span>
          )}
        </span>
        <ProgressDots row={row} />
      </button>
    </div>
  );
}

/** 5 dots filled up to the card's box, or a ★ when mastered; spoken "Box 3 of 5" / "Mastered". */
function ProgressDots({ row }: { row: WordRow }) {
  if (row.mastered) {
    return (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        role="img"
        aria-label={progressLabel(row)}
        className={styles.star}
      >
        <path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" />
      </svg>
    );
  }
  return (
    <svg
      width="58"
      height="12"
      viewBox="0 0 58 12"
      role="img"
      aria-label={progressLabel(row)}
      className={styles.dots}
    >
      {[0, 1, 2, 3, 4].map((i) =>
        i < row.box ? (
          <circle key={i} cx={6 + i * 11.5} cy="6" r="4.2" className={styles.dotOn} />
        ) : (
          <circle key={i} cx={6 + i * 11.5} cy="6" r="4" className={styles.dotOff} />
        ),
      )}
    </svg>
  );
}
