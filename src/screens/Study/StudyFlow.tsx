import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Repository } from '../../data/repository';
import {
  answerInSession,
  currentStep,
  isComplete,
  type Session,
} from '../../domain/session/session';
import { TopBar } from '../../ui/TopBar';
import { AddEditSheet, type Editor } from '../AddEdit/AddEditSheet';
import { useAppBadge } from '../../app/useAppBadge';
import type { ReminderService } from '../../data/reminders';
import { BackupPrompts } from '../Backup/BackupPrompts';
import { ReminderOffer } from '../Reminders/ReminderOffer';
import { BlankScreen, LoadingScreen } from '../Loading/LoadingScreen';
import { AllWordsScreen } from '../AllWords/AllWordsScreen';
import { AllDone, SessionComplete } from '../Rest/RestScreens';
import { enabledDecks, type Deck } from '../../domain/decks/decks';
import type { DeckId } from '../../domain/leitner/config';
import { IconButton } from '../../ui/IconButton';
import { HomeIcon } from '../../ui/icons';
import { TodayScreen } from '../Today/TodayScreen';
import { ReviewScreen } from '../Review/ReviewScreen';

/** PRD user flow 2: the loading screen shows on a cold start. 2.5 s (Yali, 2026-10-29): 1 s flashed by. */
export const MIN_LOADING_MS = 2500;
/** How long the mascot reacts to an answer before going back to idle: the hop (1s) and nod (1.3s) finish first. */
const REACTION_MS = 1400;

type StudyRepo = Pick<
  Repository,
  | 'getProfile'
  | 'getCard'
  | 'countCards'
  | 'listCards'
  | 'deckStatuses'
  | 'openDeckSession'
  | 'closeDeckSession'
  | 'recordAnswer'
  | 'addCard'
  | 'editCard'
  | 'findCardIdByWord'
  | 'saveAndStartOver'
  | 'progress'
  | 'backupStatus'
  | 'snoozeBackup'
  | 'exportBackup'
  | 'importBackup'
  | 'waitingToday'
  | 'reminderOfferOpen'
  | 'closeReminderOffer'
>;

interface StudyFlowProps {
  repo: StudyRepo;
  /** The signed-in account; turns on the backup modals (7.12). */
  userId?: string;
  /** The daily reminder (ADR-018); without it the offer never shows. */
  reminders?: ReminderService;
  /** Tests pass 0. */
  minLoadingMs?: number;
}

/**
 * The signed-in app: loading → Today (v3 brief 1.4) → a deck's session (+ practice round) →
 * session complete → Today. The cards for a session are picked once when it starts and saved
 * per deck per day; answers are saved right away, so Home (no "are you sure?") just leaves,
 * and the deck says "Paused · N left" until Continue picks it up where it stopped (1.6).
 */
export function StudyFlow({
  repo,
  userId,
  reminders,
  minLoadingMs = MIN_LOADING_MS,
}: StudyFlowProps) {
  const decks = enabledDecks();
  const deckIds = decks.map((deck) => deck.id).join(',');
  const profile = useLiveQuery(async () => (await repo.getProfile()) ?? null, [repo]);
  const cardCount = useLiveQuery(() => repo.countCards(), [repo]);
  const statuses = useLiveQuery(
    () => repo.deckStatuses(deckIds.split(',') as DeckId[]),
    [repo, deckIds],
  );
  const progress = useLiveQuery(() => repo.progress(), [repo]);
  const waiting = useLiveQuery(() => repo.waitingToday(), [repo]);
  useAppBadge(waiting);
  /** "Done for today" / "I'm done for now" was tapped on Session complete: the calm moment to offer reminders. */
  const [doneForNow, setDoneForNow] = useState(false);

  const [waited, setWaited] = useState(minLoadingMs === 0);
  useEffect(() => {
    if (minLoadingMs === 0) return;
    const timer = setTimeout(() => setWaited(true), minLoadingMs);
    return () => clearTimeout(timer);
  }, [minLoadingMs]);

  const [session, setSession] = useState<Session | null>(null);
  /** The deck whose session is open. */
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [view, setView] = useState<'today' | 'study' | 'complete' | 'allDone'>('today');
  /** The all-words page, opened from the box badge; it sits over whatever screen was showing. */
  const [allWordsOpen, setAllWordsOpen] = useState(false);
  const allCards = useLiveQuery(
    async () => (allWordsOpen ? repo.listCards() : undefined),
    [repo, allWordsOpen],
  );
  const [reaction, setReaction] = useState<'happy' | 'cheer' | null>(null);
  const saving = useRef(false);
  /** The last answer came while something on the card had focus (keyboard, screen reader). */
  const [focusNextCard, setFocusNextCard] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);

  useEffect(() => {
    if (!reaction) return;
    const timer = setTimeout(() => setReaction(null), REACTION_MS);
    return () => clearTimeout(timer);
  }, [reaction]);

  const step = session ? currentStep(session) : null;
  // Tagged with the card id: while a new step's card loads, the hook still returns the old result.
  const loaded = useLiveQuery(
    async () =>
      step ? { cardId: step.cardId, card: (await repo.getCard(step.cardId)) ?? null } : null,
    [repo, step?.cardId],
  );

  // Until the saved profile is read there is no name: show only the cream page, so the one
  // Loading screen already says "Yali's Leitner" (v3 brief 1.12).
  if (profile === undefined) return <BlankScreen />;
  if (!waited || cardCount === undefined || statuses === undefined) {
    return <LoadingScreen name={profile?.displayName} streak={progress?.streak} />;
  }

  /** Start, or continue where it stopped, a deck's session. */
  async function openDeck(deck: Deck) {
    const opened = await repo.openDeckSession(deck.id);
    if (!opened) return;
    setActiveDeck(deck);
    setSession(opened);
    setFocusNextCard(false);
    setView(isComplete(opened) ? 'complete' : 'study');
  }

  /** "Mix them all": the first deck with a paused session or cards waiting (11.6 mixes them). */
  function mix() {
    const index = statuses!.findIndex((status) => status.pausedLeft !== null || status.waiting > 0);
    if (index === -1) setView('allDone');
    else void openDeck(decks[index]);
  }

  function goHome() {
    setSession(null);
    setActiveDeck(null);
    setView('today');
  }

  const homeButton = (
    <IconButton
      label="Home"
      variant="white"
      icon={<HomeIcon size={20} style={{ strokeWidth: 2.5 }} />}
      onClick={goHome}
    />
  );
  const topBar = (leading?: ReactNode) => (
    <TopBar
      leading={leading}
      cardCount={cardCount}
      onOpenBox={() => setAllWordsOpen(true)}
      streak={progress?.streak}
      onAdd={(deck) => setEditor({ mode: 'add', deck })}
    />
  );
  const sheet = <AddEditSheet repo={repo} editor={editor} onClose={() => setEditor(null)} />;
  // Every screen after loading goes through here, even the in-between empty frames, so the
  // sheets and backup modals stay mounted (and keep their state) while screens change.
  const withSheet = (screen: ReactNode) => (
    <>
      {screen}
      {sheet}
      {userId && <BackupPrompts repo={repo} userId={userId} paused={editor !== null} />}
      <ReminderOffer repo={repo} reminders={reminders} active={doneForNow && editor === null} />
    </>
  );

  if (allWordsOpen) {
    return withSheet(
      <AllWordsScreen
        cards={allCards}
        onBack={() => setAllWordsOpen(false)}
        onAdd={(deck) => setEditor({ mode: 'add', deck })}
      />,
    );
  }

  if (view === 'today') {
    return withSheet(
      <TodayScreen
        name={profile?.displayName ?? null}
        decks={decks}
        statuses={statuses}
        top={topBar()}
        onMix={mix}
        onStudy={(deck) => void openDeck(deck)}
        onAdd={(deck) => setEditor({ mode: 'add', deck })}
      />,
    );
  }

  if (view === 'allDone') {
    return withSheet(
      <AllDone
        emptyBox={cardCount === 0}
        top={topBar(homeButton)}
        onAddWord={() => setEditor({ mode: 'add', deck: decks[0] })}
      />,
    );
  }

  if (view === 'complete' && session && activeDeck) {
    const index = decks.findIndex((deck) => deck.id === activeDeck.id);
    const nextCount = statuses[index]?.waiting ?? 0;
    return withSheet(
      <SessionComplete
        wordCount={session.scheduled.length}
        nextCount={nextCount}
        streak={progress?.streak}
        focusOnStart={focusNextCard}
        onNext={() => void openDeck(activeDeck)}
        onDone={() => {
          setDoneForNow(true);
          goHome();
        }}
      />,
    );
  }

  if (!session || !step || !activeDeck) return withSheet(null);

  if (!loaded || loaded.cardId !== step.cardId) return withSheet(null); // the card is loading (a few ms)
  const card = loaded.card;

  /** The session is over: forget it (the deck stops saying "Paused") and celebrate. */
  function finish(deck: Deck) {
    void repo.closeDeckSession(deck.id);
    setView('complete');
  }

  if (card === null) {
    // The card was deleted on another device mid-session: skip it.
    const next = answerInSession(session, true);
    setSession(next);
    if (isComplete(next)) finish(activeDeck);
    return withSheet(null);
  }

  async function handleAnswer(correct: boolean) {
    if (!session || !step || !activeDeck || saving.current) return;
    saving.current = true;
    // Touch taps don't focus buttons on iPhone, so this is only true for keyboard and
    // screen-reader use (and mouse clicks in some browsers, where it does no harm).
    setFocusNextCard(document.activeElement !== null && document.activeElement !== document.body);
    try {
      await repo.recordAnswer(step.cardId, correct, step.kind);
      const next = answerInSession(session, correct);
      setReaction(correct ? 'happy' : 'cheer');
      setSession(next);
      if (isComplete(next)) finish(activeDeck);
    } finally {
      saving.current = false;
    }
  }

  const scheduledCount = session.scheduled.length;
  return withSheet(
    <ReviewScreen
      // A fresh card each step: back to the front, swipe reset.
      key={session.answered}
      card={card}
      kind={step.kind}
      progress={Math.min(session.answered, scheduledCount) / scheduledCount}
      practiceLeft={scheduledCount + session.practice.length - session.answered}
      reaction={reaction}
      onAnswer={handleAnswer}
      focusOnStart={focusNextCard}
      onEdit={() => setEditor({ mode: 'edit', cardId: card.card.id })}
      top={topBar(homeButton)}
    />,
  );
}
