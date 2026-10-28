import { useState, type ReactNode } from 'react';
import { BottomPanel } from '../ui/BottomPanel';
import { Button } from '../ui/Button';
import { Card, CardStack } from '../ui/Card';
import { IconButton } from '../ui/IconButton';
import { BookIcon, FlameIcon, FlipIcon, PencilIcon, PlusIcon } from '../ui/icons';
import { AddPill, Pill } from '../ui/Pill';
import { Sheet } from '../ui/Sheet';
import { TextField } from '../ui/TextField';
import { TopBar } from '../ui/TopBar';
import styles from './KitPage.module.css';

/**
 * Dev-only gallery of the UI kit (roadmap 7.7). Open http://localhost:5173/leitner-app/?kit
 * Add &open=bottom or &open=dialog to start with a sheet open (for screenshots).
 * main.tsx only loads this when import.meta.env.DEV, so it never ships.
 */
export function KitPage() {
  const startOpen = new URLSearchParams(location.search).get('open');
  const [sheet, setSheet] = useState<'bottom' | 'dialog' | null>(
    startOpen === 'bottom' || startOpen === 'dialog' ? startOpen : null,
  );
  const close = () => setSheet(null);

  return (
    <main className={styles.page}>
      <TopBar wordsLearned={128} streak={12} onAdd={() => setSheet('bottom')} />

      <Section title="Buttons">
        <Button>Save word</Button>
        <div className={`${styles.row} ${styles.grow}`}>
          <Button variant="secondary">Not yet</Button>
          <Button>Knew it!</Button>
        </div>
        <div className={styles.row}>
          <IconButton label="Add word" icon={<PlusIcon size={26} />} />
          <IconButton label="Edit word" variant="cream" icon={<PencilIcon />} />
          <Button variant="text">I'm done for now</Button>
        </div>
      </Section>

      <Section title="Pills">
        <div className={styles.row}>
          <Pill variant="stat" icon={<BookIcon />} srLabel="128 words learned">
            128
          </Pill>
          <Pill variant="stat" icon={<FlameIcon />} srLabel="12-day streak">
            12
          </Pill>
        </div>
        <div className={styles.row}>
          <Pill variant="tag">careful</Pill>
          <Pill variant="tag">precise</Pill>
          <Pill variant="label">do you know it?</Pill>
          <Pill variant="label" tone="aqua">
            one more look
          </Pill>
        </div>
        <div className={styles.row}>
          <AddPill>similar word</AddPill>
          <AddPill>meaning</AddPill>
        </div>
      </Section>

      <Section title="Card stack">
        <CardStack className={styles.stack}>
          <Card className={styles.front}>
            <Pill variant="label">do you know it?</Pill>
            <span className={styles.word}>meticulous</span>
            <span className={styles.hint}>
              <FlipIcon /> tap to flip
            </span>
          </Card>
        </CardStack>
      </Section>

      <Section title="Bottom panels" className={styles.panels}>
        <BottomPanel color="orange" mascot={<MascotStandIn />}>
          <div className={`${styles.row} ${styles.grow}`}>
            <Button variant="secondary">Not yet</Button>
            <Button>Knew it!</Button>
          </div>
        </BottomPanel>
        <BottomPanel color="aqua">
          <p className={styles.panelTitle}>Just for practice</p>
        </BottomPanel>
        <BottomPanel color="orange" size="tall">
          <p className={styles.bigTitle}>Session complete!</p>
          <p>You went through 20 words. Nice work.</p>
          <div className={styles.push} />
          <Button>Next 20 words</Button>
          <Button variant="text">I'm done for now</Button>
        </BottomPanel>
      </Section>

      <Section title="Sheets">
        <Button variant="secondary" onClick={() => setSheet('bottom')}>
          Open bottom sheet
        </Button>
        <Button variant="secondary" onClick={() => setSheet('dialog')}>
          Open dialog
        </Button>
      </Section>

      <Sheet
        open={sheet === 'bottom'}
        onClose={close}
        title="New word"
        mascot={<MascotStandIn />}
        footer={<Button onClick={close}>Save word</Button>}
      >
        <TextField label="The word" defaultValue="meticulous" />
        <TextField label="Similar words" defaultValue="careful" />
        <TextField label="In Persian" lang="fa" error="Add at least one meaning." />
        <TextField label="In a sentence" defaultValue="She keeps meticulous notes." />
        <div className={styles.row}>
          <AddPill>similar word</AddPill>
          <AddPill>meaning</AddPill>
          <AddPill>sentence</AddPill>
        </div>
      </Sheet>

      <Sheet
        open={sheet === 'dialog'}
        onClose={close}
        variant="dialog"
        title="Oh! You already have “meticulous”"
        mascot={<MascotStandIn />}
        footer={
          <>
            <Button onClick={close}>Open my card</Button>
            <Button variant="text" onClick={close}>
              Cancel
            </Button>
          </>
        }
      >
        <p className={styles.secondary}>
          I'll open your card and move it back to the start, so you'll see it again tomorrow.
        </p>
      </Sheet>
    </main>
  );
}

function Section({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={[styles.section, className].filter(Boolean).join(' ')}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

/** Placeholder until the real mascot arrives in roadmap 7.8. */
function MascotStandIn() {
  return <div className={styles.mascot} />;
}
