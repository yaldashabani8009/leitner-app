import type { ReactNode } from 'react';
import type { CardWithEntries } from '../../data/repository';
import { BottomPanel } from '../../ui/BottomPanel';
import { Button } from '../../ui/Button';
import { Card, CardStack } from '../../ui/Card';
import { Confetti } from '../../ui/Confetti';
import { Mascot } from '../../ui/Mascot/Mascot';
import { CardBack } from './CardBack';
import styles from './ReviewScreen.module.css';
import { useReviewKeys } from './useReviewKeys';

interface CardViewScreenProps {
  card: CardWithEntries;
  onEdit: () => void;
  onDone: () => void;
  top?: ReactNode;
  /** A line above Done; none from the all-words page. */
  note?: string;
}

/**
 * One card to read, opened from the all-words page (v3 brief 1.9): the card back as in review,
 * with the pencil (Edit), and "Done" to go back to the list.
 */
export function CardViewScreen({ card, onEdit, onDone, top, note }: CardViewScreenProps) {
  useReviewKeys({ onEdit });
  return (
    <main className={styles.screen}>
      <Confetti amount="touch" />
      {top}
      <div className={styles.stage}>
        <CardStack className={styles.stackBack}>
          <Card className={styles.back} aria-label={`Your card: ${card.card.word}`}>
            <CardBack card={card} onEdit={onEdit} />
          </Card>
        </CardStack>
      </div>
      <BottomPanel
        color="aqua"
        className={styles.panel}
        mascot={<Mascot pose="idle" size="small" decorative />}
      >
        {note && <p className={styles.reassure}>{note}</p>}
        <Button variant="secondary" onClick={onDone}>
          Done
        </Button>
      </BottomPanel>
    </main>
  );
}
