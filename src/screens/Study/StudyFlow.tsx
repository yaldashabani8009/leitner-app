import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Repository } from '../../data/repository';
import {
  answerInSession,
  currentStep,
  isComplete,
  startSession,
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
import { AllDone, Resting, SessionComplete } from '../Rest/RestScreens';
import { enabledDecks } from '../../domain/decks/decks';
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
  | 'nextSessionCardIds'
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
 * The signed-in app (PRD user flow 2–6): loading → review (+ practice round) → session
 * complete, or "All done for today" when nothing is due or the daily cap is reached.
 * The cards for a session are picked once when it starts; answers are saved right away,
 * so leaving mid-session keeps unanswered cards due (sessions rule 7).
 */
export function StudyFlow({
  repo,
  userId,
  reminders,
  minLoadingMs = MIN_LOADING_MS,
}: StudyFlowProps) {
  const profile = useLiveQuery(async () => (await repo.getProfile()) ?? null, [repo]);
  const cardCount = useLiveQuery(() => repo.countCards(), [repo]);
  const dueIds = useLiveQuery(() => repo.nextSessionCardIds(), [repo]);
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
  const [view, setView] = useState<'study' | 'complete' | 'resting'>('study');
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
  if (!waited || cardCount === undefined || dueIds === undefined) {
    return <LoadingScreen name={profile?.displayName} streak={progress?.streak} />;
  }

  function startNext() {
    setSession(dueIds && dueIds.length > 0 ? startSession(dueIds) : null);
    setView('study');
  }

  const top = (
    <TopBar
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

  // Start a session as soon as cards are due (also on first open of the day).
  if (view === 'study' && session === null && dueIds.length > 0) {
    setSession(startSession(dueIds));
    return withSheet(null);
  }

  if (view === 'complete' && session) {
    return withSheet(
      <SessionComplete
        wordCount={session.scheduled.length}
        nextCount={dueIds.length}
        streak={progress?.streak}
        focusOnStart={focusNextCard}
        onNext={startNext}
        onDone={() => {
          setDoneForNow(true);
          if (dueIds.length > 0) {
            setView('resting');
          } else {
            setSession(null);
            setView('study');
          }
        }}
      />,
    );
  }

  if (view === 'resting') return withSheet(<Resting top={top} onKeepGoing={startNext} />);

  if (!session || !step) {
    return withSheet(
      <AllDone
        emptyBox={cardCount === 0}
        top={top}
        onAddWord={() => setEditor({ mode: 'add', deck: enabledDecks()[0] })}
      />,
    );
  }

  if (!loaded || loaded.cardId !== step.cardId) return withSheet(null); // the card is loading (a few ms)
  const card = loaded.card;
  if (card === null) {
    // The card was deleted on another device mid-session: skip it.
    const next = answerInSession(session, true);
    setSession(next);
    if (isComplete(next)) setView('complete');
    return withSheet(null);
  }

  async function handleAnswer(correct: boolean) {
    if (!session || !step || saving.current) return;
    saving.current = true;
    // Touch taps don't focus buttons on iPhone, so this is only true for keyboard and
    // screen-reader use (and mouse clicks in some browsers, where it does no harm).
    setFocusNextCard(document.activeElement !== null && document.activeElement !== document.body);
    try {
      await repo.recordAnswer(step.cardId, correct, step.kind);
      const next = answerInSession(session, correct);
      setReaction(correct ? 'happy' : 'cheer');
      setSession(next);
      if (isComplete(next)) setView('complete');
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
      top={top}
    />,
  );
}
