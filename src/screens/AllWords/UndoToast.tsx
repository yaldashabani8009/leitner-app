import styles from './UndoToast.module.css';

interface UndoToastProps {
  /** The deleted word; null shows nothing (the live region stays so the next one is read out). */
  word: string | null;
  onUndo: () => void;
}

/** "reluctant deleted" with Undo, at the bottom, for about 5 s (canvas N10). */
export function UndoToast({ word, onUndo }: UndoToastProps) {
  return (
    <div role="status" className={styles.region}>
      {word !== null && (
        <div className={styles.toast}>
          <span className={styles.text}>
            <b>{word}</b> deleted
          </span>
          <button type="button" className={styles.undo} onClick={onUndo}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
