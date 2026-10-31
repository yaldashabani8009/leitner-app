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
import { UndoToast } from '../AllWords/UndoToast';
import { CardViewScreen } from '../Review/CardViewScreen';
import { AllDone, SessionComplete } from '../Rest/RestScreens';
import { enabledDecks, type Deck } from '../../domain/decks/decks';
import type { DeckId } from '../../domain/leitner/config';
import { IconButton } from '../../ui/IconButton';
import { HomeIcon, SettingsIcon } from '../../ui/icons';
import { SettingsSheet } from '../Settings/SettingsSheet';
import { useAppShortcuts } from '../../app/useAppShortcuts';
import { TodayScreen } from '../Today/TodayScreen';
import { PracticeDone } from '../Practice/PracticeDone';
import { missedInRound, practiceOrder, type PracticeCard } from '../../domain/session/extra';
import { ReviewScreen } from '../Review/ReviewScreen';
import { SpellingScreen } from '../Spelling/SpellingScreen';
import type { Speech } from '../../services/speech';
import { appSpeech } from '../../services/useSpeech';

/** A round of extra practice: the cards it may repeat, this round's order and answers. */
interface Extra {
  cards: readonly PracticeCard[];
  order: string[];
  index: number;
  answers: Map<string, boolean>;
}

/** The open session: one deck's, or "Mix them all" with each card's deck. */
type Run = { kind: 'deck'; deck: Deck } | { kind: 'mix'; deckOf: Record<string, DeckId> };

/** Canvas N10: the "deleted" toast with Undo stays about 5 s. */
export const UNDO_MS = 5000;

/** PRD user flow 2: the loading screen shows on a cold start. 2.5 s (Yali, 2026-10-29): 1 s flashed by. */
export const MIN_LOADING_MS = 2500;
/** How long the mascot reacts to an answer before going back to idle: the hop (1s) and nod (1.3s) finish first. */
const REACTION_MS = 1400;

type StudyRepo = Pick<
  Repository,
  | 'getProfile'
  | 'getCard'
  | 'countCards'
  | 'allWordRows'
  | 'deleteCard'
  | 'restoreCard'
  | 'deckStatuses'
  | 'openDeckSession'
  | 'closeDeckSession'
  | 'openMixSession'
  | 'closeMixSession'
  | 'mixPausedLeft'
  | 'cardsAddedOn'
  | 'todayDate'
  | 'recordAnswer'
  | 'cardWords'
  | 'addCard'
  | 'editCard'
  | 'findCardIdByWord'
  | 'saveAndStartOver'
  | 'addSpellingWords'
  | 'spellingKeys'
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
  /** Sign out (Settings, canvas N13). Without it there is no settings button. */
  onSignOut?: () => void;
  /** Says spelling words (ADR-021). Tests pass a fake; the default is the browser's voice. */
  speech?: Speech | null;
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
  onSignOut,
  speech = appSpeech(),
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
  const mixPausedLeft = useLiveQuery(() => repo.mixPausedLeft(), [repo]);
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
  /** What the open session is: one deck's, or Mix them all (with each card's deck for the chip). */
  const [run, setRun] = useState<Run | null>(null);
  const [view, setView] = useState<
    'today' | 'study' | 'complete' | 'allDone' | 'extra' | 'extraDone'
  >('today');
  /** A round of extra practice (v3 brief 1.7): never moves a card. */
  const [extra, setExtra] = useState<Extra | null>(null);
  /** The all-words page, opened from the box badge; it sits over whatever screen was showing. */
  const [allWordsOpen, setAllWordsOpen] = useState(false);
  const todayDate = useLiveQuery(() => repo.todayDate(), [repo]);
  const allRows = useLiveQuery(
    async () => (allWordsOpen ? repo.allWordRows() : undefined),
    [repo, allWordsOpen],
  );
  /** A card opened from the all-words page. */
  const [viewingId, setViewingId] = useState<string | null>(null);
  const viewing = useLiveQuery(
    async () => (viewingId ? ((await repo.getCard(viewingId)) ?? null) : null),
    [repo, viewingId],
  );
  /** The last delete, for the Undo toast (about 5 s, canvas N10). */
  const [deleted, setDeleted] = useState<{ id: string; word: string; at: number } | null>(null);
  useEffect(() => {
    if (!deleted) return;
    const timer = setTimeout(() => setDeleted(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [deleted]);
  /** A spelling word has been played from a tap in this session: sound is unlocked (ADR-021). */
  const [soundOn, setSoundOn] = useState(false);
  const [reaction, setReaction] = useState<'happy' | 'cheer' | null>(null);
  const saving = useRef(false);
  /** The last answer came while something on the card had focus (keyboard, screen reader). */
  const [focusNextCard, setFocusNextCard] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Goes up each time N is pressed; the + on screen opens (laptop, v3 brief 1.12). */
  const [addSignal, setAddSignal] = useState(0);
  useAppShortcuts({
    onAdd: () => setAddSignal((n) => n + 1),
    onHome: () => {
      setAllWordsOpen(false);
      setViewingId(null);
      setSession(null);
      setRun(null);
      setExtra(null);
      setView('today');
    },
    onSearch: () => document.querySelector<HTMLInputElement>('[data-search]')?.focus(),
  });

  useEffect(() => {
    if (!reaction) return;
    const timer = setTimeout(() => setReaction(null), REACTION_MS);
    return () => clearTimeout(timer);
  }, [reaction]);

  const step = session ? currentStep(session) : null;
  const extraCardId = view === 'extra' && extra ? extra.order[extra.index] : undefined;
  const shownCardId = extraCardId ?? step?.cardId;
  // Tagged with the card id: while a new step's card loads, the hook still returns the old result.
  const loaded = useLiveQuery(
    async () =>
      shownCardId ? { cardId: shownCardId, card: (await repo.getCard(shownCardId)) ?? null } : null,
    [repo, shownCardId],
  );

  // The words of this session's cards: a spelling word is spoken straight from the tap that
  // moves on to it, before its card is read from the database (iPhone only allows sound then).
  const runIds = (view === 'extra' ? extra?.order : session?.scheduled)?.join(',') ?? '';
  const words = useLiveQuery(
    async (): Promise<Record<string, string>> =>
      runIds ? repo.cardWords(runIds.split(',')) : {},
    [repo, runIds],
  );

  // Until the saved profile is read there is no name: show only the cream page, so the one
  // Loading screen already says "Yali's Leitner" (v3 brief 1.12).
  if (profile === undefined) return <BlankScreen />;
  if (!waited || cardCount === undefined || statuses === undefined) {
    return <LoadingScreen name={profile?.displayName} streak={progress?.streak} />;
  }

  function begin(opened: Session, next: Run) {
    setRun(next);
    setSession(opened);
    setSoundOn(false);
    setFocusNextCard(false);
    setView(isComplete(opened) ? 'complete' : 'study');
  }

  /** Start, or continue where it stopped, a deck's session. */
  async function openDeck(deck: Deck) {
    const opened = await repo.openDeckSession(deck.id);
    if (opened) begin(opened, { kind: 'deck', deck });
  }

  /**
   * "Mix them all" (v3 brief 1.5): every deck with cards due, in one stream of random 3–9
   * chunks. With nothing due anywhere: "All done for today" (11.7 makes this extra practice).
   */
  async function mix() {
    const ids = decks.map((deck) => deck.id);
    const opened = await repo.openMixSession(ids);
    if (opened) begin(opened.session, { kind: 'mix', deckOf: opened.deckOf });
    // Nothing due in any deck: practise today's new words from all decks instead.
    else startExtra(await repo.cardsAddedOn(ids));
  }

  /** One round of extra practice over these cards, shuffled again; none → "All done for today". */
  function startExtra(cards: readonly PracticeCard[]) {
    const order = practiceOrder(cards, Math.random);
    if (order.length === 0) {
      setView('allDone');
      return;
    }
    setSession(null);
    setRun(null);
    setSoundOn(false);
    setFocusNextCard(false);
    setExtra({ cards, order, index: 0, answers: new Map() });
    setView('extra');
  }

  function openRun(current: Run) {
    if (current.kind === 'mix') void mix();
    else void openDeck(current.deck);
  }

  function goHome() {
    setSession(null);
    setRun(null);
    setExtra(null);
    setView('today');
  }

  /** Which deck a card of the open session or practice round is in. */
  function deckOfCard(cardId: string): DeckId | undefined {
    if (view === 'extra') return extra?.cards.find((card) => card.id === cardId)?.deck;
    if (!run) return undefined;
    return run.kind === 'deck' ? run.deck.id : run.deckOf[cardId];
  }

  /** Called inside the tap / key / swipe that moves on: say the next word if it's a spelling card. */
  function sayIfSpelling(cardId: string | undefined) {
    const word = cardId === undefined ? undefined : words?.[cardId];
    if (!speech || word === undefined || deckOfCard(cardId as string) !== 'spelling') return;
    speech.speak(word);
    setSoundOn(true);
  }

  /** A spelling card, in a session or a practice round (v3 brief 1.3, canvas P5–P7). */
  function spellingScreen(props: {
    cardId: string;
    kind: 'scheduled' | 'practice';
    progress: number;
    onRecord: (correct: boolean, typed: string | null) => void;
    onNext: (correct: boolean) => void;
  }) {
    const word = words?.[props.cardId];
    if (word === undefined) return withSheet(null);
    return withSheet(
      <SpellingScreen
        {...props}
        word={word}
        speech={speech}
        needsStart={!soundOn}
        onStarted={() => setSoundOn(true)}
        top={topBar(homeButton)}
      />,
    );
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
      addSignal={addSignal}
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
      {onSignOut && userId && (
        <SettingsSheet
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          userId={userId}
          name={profile?.displayName ?? null}
          reminders={reminders}
          onDeviceOn={() => void repo.closeReminderOffer('done')}
          onSignOut={() => {
            setSettingsOpen(false);
            onSignOut();
          }}
        />
      )}
    </>
  );

  if (allWordsOpen && viewingId && viewing && viewing.card.id === viewingId) {
    return withSheet(
      <CardViewScreen
        card={viewing}
        onEdit={() => setEditor({ mode: 'edit', cardId: viewingId })}
        onDone={() => setViewingId(null)}
      />,
    );
  }

  if (allWordsOpen) {
    return withSheet(
      <AllWordsScreen
        rows={allRows}
        decks={decks}
        today={todayDate ?? ''}
        onBack={() => {
          setAllWordsOpen(false);
          setDeleted(null);
        }}
        onAdd={(deck) => setEditor({ mode: 'add', deck })}
        onOpenCard={setViewingId}
        addSignal={addSignal}
        onDelete={(row) => {
          void repo.deleteCard(row.id);
          setDeleted({ id: row.id, word: row.word, at: Date.now() });
        }}
        onPracticeDay={(day, deckIds) =>
          void repo.cardsAddedOn(deckIds, day).then((cards) => {
            setAllWordsOpen(false);
            startExtra(cards);
          })
        }
        toast={
          <UndoToast
            word={deleted?.word ?? null}
            onUndo={() => {
              if (!deleted) return;
              void repo.restoreCard(deleted.id);
              setDeleted(null);
            }}
          />
        }
      />,
    );
  }

  if (view === 'today') {
    return withSheet(
      <TodayScreen
        name={profile?.displayName ?? null}
        decks={decks}
        statuses={statuses}
        mixPausedLeft={mixPausedLeft ?? null}
        top={topBar(
          onSignOut && userId ? (
            <IconButton
              label="Settings"
              variant="white"
              icon={<SettingsIcon size={20} style={{ strokeWidth: 2.5 }} />}
              onClick={() => setSettingsOpen(true)}
            />
          ) : undefined,
        )}
        onMix={() => void mix()}
        onStudy={(deck) => void openDeck(deck)}
        onAdd={(deck) => setEditor({ mode: 'add', deck })}
        onPractice={(deck) => void repo.cardsAddedOn([deck.id]).then(startExtra)}
      />,
    );
  }

  if (view === 'extraDone' && extra) {
    const missed = missedInRound(extra.order, extra.answers);
    return withSheet(
      <PracticeDone
        missed={missed.length}
        onAgain={() => startExtra(extra.cards.filter((card) => missed.includes(card.id)))}
        onDone={goHome}
      />,
    );
  }

  if (view === 'extra' && extra) {
    const current = extra;
    if (extraCardId !== undefined && deckOfCard(extraCardId) === 'spelling') {
      const cardId = extraCardId;
      return spellingScreen({
        cardId,
        kind: 'practice',
        progress: current.index / current.order.length,
        onRecord: (correct, typed) =>
          void repo.recordAnswer(cardId, correct, 'practice', typed),
        onNext: (correct) => {
          const index = current.index + 1;
          sayIfSpelling(current.order[index]);
          setExtra({ ...current, index, answers: new Map(current.answers).set(cardId, correct) });
          if (index >= current.order.length) setView('extraDone');
        },
      });
    }
    if (!loaded || loaded.cardId !== extraCardId) return withSheet(null);
    const next = (answers: Map<string, boolean>) => {
      const index = current.index + 1;
      setExtra({ ...current, index, answers });
      if (index >= current.order.length) setView('extraDone');
    };
    if (loaded.card === null) {
      // Deleted on another device meanwhile: skip it.
      next(current.answers);
      return withSheet(null);
    }
    const extraCard = loaded.card;
    const answerExtra = async (correct: boolean) => {
      if (saving.current) return;
      saving.current = true;
      setFocusNextCard(document.activeElement !== null && document.activeElement !== document.body);
      try {
        sayIfSpelling(current.order[current.index + 1]);
        await repo.recordAnswer(extraCard.card.id, correct, 'practice');
        next(new Map(current.answers).set(extraCard.card.id, correct));
      } finally {
        saving.current = false;
      }
    };
    return withSheet(
      <ReviewScreen
        key={`extra-${current.order.length}-${current.index}`}
        card={extraCard}
        kind="scheduled"
        progress={0}
        extra={{ left: current.order.length - current.index }}
        practiceLeft={0}
        reaction={null}
        onAnswer={(correct) => void answerExtra(correct)}
        focusOnStart={focusNextCard}
        onEdit={() => setEditor({ mode: 'edit', cardId: extraCard.card.id })}
        top={topBar(homeButton)}
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

  if (view === 'complete' && session && run) {
    const nextCount =
      run.kind === 'mix'
        ? statuses.reduce((sum, status) => sum + status.waiting, 0)
        : (statuses[decks.findIndex((deck) => deck.id === run.deck.id)]?.waiting ?? 0);
    return withSheet(
      <SessionComplete
        wordCount={session.scheduled.length}
        nextCount={nextCount}
        streak={progress?.streak}
        focusOnStart={focusNextCard}
        onNext={() => openRun(run)}
        onDone={() => {
          setDoneForNow(true);
          goHome();
        }}
      />,
    );
  }

  if (!session || !step || !run) return withSheet(null);

  /** The session is over: forget it (the deck stops saying "Paused") and celebrate. */
  function finish(current: Run) {
    void (current.kind === 'mix' ? repo.closeMixSession() : repo.closeDeckSession(current.deck.id));
    setView('complete');
  }

  const scheduledCount = session.scheduled.length;
  const sessionProgress = Math.min(session.answered, scheduledCount) / scheduledCount;

  // Spelling cards don't wait for the card to load: the screen (and the iPhone keyboard) stays put.
  if (deckOfCard(step.cardId) === 'spelling') {
    const current = session;
    const currentRun = run;
    const cardId = step.cardId;
    const kind = step.kind;
    return spellingScreen({
      cardId,
      kind,
      progress: kind === 'practice' ? 1 : sessionProgress,
      onRecord: (correct, typed) => void repo.recordAnswer(cardId, correct, kind, typed),
      onNext: (correct) => {
        const next = answerInSession(current, correct);
        sayIfSpelling(currentStep(next)?.cardId);
        setSession(next);
        if (isComplete(next)) finish(currentRun);
      },
    });
  }

  if (!loaded || loaded.cardId !== step.cardId) return withSheet(null); // the card is loading (a few ms)
  const card = loaded.card;

  if (card === null) {
    // The card was deleted on another device mid-session: skip it.
    const next = answerInSession(session, true);
    setSession(next);
    if (isComplete(next)) finish(run);
    return withSheet(null);
  }

  async function handleAnswer(correct: boolean) {
    if (!session || !step || !run || saving.current) return;
    saving.current = true;
    // Touch taps don't focus buttons on iPhone, so this is only true for keyboard and
    // screen-reader use (and mouse clicks in some browsers, where it does no harm).
    setFocusNextCard(document.activeElement !== null && document.activeElement !== document.body);
    try {
      const next = answerInSession(session, correct);
      // Mix them all: a spelling card next is said from this swipe or tap (ADR-021).
      sayIfSpelling(currentStep(next)?.cardId);
      await repo.recordAnswer(step.cardId, correct, step.kind);
      setReaction(correct ? 'happy' : 'cheer');
      setSession(next);
      if (isComplete(next)) finish(run);
    } finally {
      saving.current = false;
    }
  }

  return withSheet(
    <ReviewScreen
      // A fresh card each step: back to the front, swipe reset.
      key={session.answered}
      card={card}
      kind={step.kind}
      progress={sessionProgress}
      deck={
        run.kind === 'mix' ? decks.find((deck) => deck.id === run.deckOf[card.card.id]) : undefined
      }
      practiceLeft={scheduledCount + session.practice.length - session.answered}
      reaction={reaction}
      onAnswer={handleAnswer}
      focusOnStart={focusNextCard}
      onEdit={() => setEditor({ mode: 'edit', cardId: card.card.id })}
      top={topBar(homeButton)}
    />,
  );
}
