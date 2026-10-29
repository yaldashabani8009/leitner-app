import type { ReactNode } from 'react';
import type { CardWithEntries } from '../../data/repository';
import { BottomPanel } from '../../ui/BottomPanel';
import { Button } from '../../ui/Button';
import { Card, CardStack } from '../../ui/Card';
import { Confetti } from '../../ui/Confetti';
import { Mascot } from '../../ui/Mascot/Mascot';
import { CardBack } from './CardBack';
import styles from './ReviewScreen.module.css';

interface CardViewScreenProps {
  card: CardWithEntries;
  onEdit: () => void;
  onDone: () => void;
  top?: ReactNode;
}

/**
 * One card to read, after "Open my card" in the duplicate dialog (decided 2026-10-29):
 * the card back as in review, with the pencil, and "Done" to go back to where you were.
 */
export function CardViewScreen({ card, onEdit, onDone, top }: CardViewScreenProps) {
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
        <p className={styles.reassure}>It's back at the start. You'll see it again tomorrow.</p>
        <Button variant="secondary" onClick={onDone}>
          Done
        </Button>
      </BottomPanel>
    </main>
  );
}
