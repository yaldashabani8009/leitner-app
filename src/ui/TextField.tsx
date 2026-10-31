import { useId, type ComponentPropsWithRef, type ReactNode } from 'react';
import styles from './TextField.module.css';

interface TextFieldProps extends Omit<ComponentPropsWithRef<'input'>, 'id'> {
  label: string;
  /** Shown under the field, in the error colour (PRD: errors appear under the field). */
  error?: string;
  /** Shown right under the field, e.g. "Already in your Vocab box" (canvas N5). */
  note?: ReactNode;
}

export function TextField({ label, error, note, className, ...input }: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...input}
      />
      {note}
      {error && (
        <p id={errorId} className={styles.error}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={styles.icon}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 7v6M12 17h.01" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
