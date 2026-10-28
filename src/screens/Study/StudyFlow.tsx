import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import type { Repository } from '../../data/repository';
import {
  answerInSession,
  currentStep,
  isComplete,
  startSession,
  type Session,
} from '../../domain/session/session';
import { TopBar } from '../../ui/TopBar';
import { LoadingScreen } from '../Loading/LoadingScreen';
import { AllDone, Resting, SessionComplete } from '../Rest/RestScreens';
import { ReviewScreen } from '../Review/ReviewScreen';

/** PRD user flow 2: the loading screen shows for about a second on a cold start. */
export const MIN_LOADING_MS = 1000;
/** How long the mascot reacts to an answer before going back to idle. */
const REACTION_MS = 900;

type StudyRepo = Pick<
  Repository,
  'getProfile' | 'getCard' | 'countCards' | 'nextSessionCardIds' | 'recordAnswer'
>;

interface StudyFlowProps {
  repo: StudyRepo;
  /** Tests pass 0. */
  minLoadingMs?: number;
}

/**
 * The signed-in app (PRD user flow 2–6): loading → review (+ practice round) → session
 * complete, or "All done for today" when nothing is due or the daily cap is reached.
 * The cards for a session are picked once when it starts; answers are saved right away,
 * so leaving mid-session keeps unanswered cards due (sessions rule 7).
 */
export function StudyFlow({ repo, minLoadingMs = MIN_LOADING_MS }: StudyFlowProps) {
  const profile = useLiveQuery(async () => (await repo.getProfile()) ?? null, [repo]);
  const cardCount = useLiveQuery(() => repo.countCards(), [repo]);
  const dueIds = useLiveQuery(() => repo.nextSessionCardIds(), [repo]);

  const [waited, setWaited] = useState(minLoadingMs === 0);
  useEffect(() => {
    if (minLoadingMs === 0) return;
    const timer = setTimeout(() => setWaited(true), minLoadingMs);
    return () => clearTimeout(timer);
  }, [minLoadingMs]);

  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<'study' | 'complete' | 'resting'>('study');
  const [reaction, setReaction] = useState<'happy' | 'cheer' | null>(null);
  const saving = useRef(false);

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

  if (!waited || profile === undefined || cardCount === undefined || dueIds === undefined) {
    return <LoadingScreen name={profile?.displayName} />;
  }

  // Start a session as soon as cards are due (also on first open of the day).
  if (view === 'study' && session === null && dueIds.length > 0) {
    setSession(startSession(dueIds));
    return null;
  }

  function startNext() {
    setSession(dueIds && dueIds.length > 0 ? startSession(dueIds) : null);
    setView('study');
  }

  const top = <TopBar />;

  if (view === 'complete' && session) {
    return (
      <SessionComplete
        wordCount={session.scheduled.length}
        nextCount={dueIds.length}
        onNext={startNext}
        onDone={() => {
          if (dueIds.length > 0) {
            setView('resting');
          } else {
            setSession(null);
            setView('study');
          }
        }}
      />
    );
  }

  if (view === 'resting') return <Resting top={top} onKeepGoing={startNext} />;

  if (!session || !step) return <AllDone emptyBox={cardCount === 0} top={top} />;

  if (!loaded || loaded.cardId !== step.cardId) return null; // the card is loading (a few ms)
  const card = loaded.card;
  if (card === null) {
    // The card was deleted on another device mid-session: skip it.
    const next = answerInSession(session, true);
    setSession(next);
    if (isComplete(next)) setView('complete');
    return null;
  }

  async function handleAnswer(correct: boolean) {
    if (!session || !step || saving.current) return;
    saving.current = true;
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
  return (
    <ReviewScreen
      // A fresh card each step: back to the front, swipe reset.
      key={session.answered}
      card={card}
      kind={step.kind}
      progress={Math.min(session.answered, scheduledCount) / scheduledCount}
      practiceLeft={scheduledCount + session.practice.length - session.answered}
      reaction={reaction}
      onAnswer={handleAnswer}
      top={top}
    />
  );
}
