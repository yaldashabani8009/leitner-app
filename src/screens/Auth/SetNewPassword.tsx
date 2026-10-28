import { useState } from 'react';
import type { AuthService } from '../../data/auth';
import { Button } from '../../ui/Button';
import { TextField } from '../../ui/TextField';
import styles from './Auth.module.css';
import { AuthLayout } from './AuthLayout';
import { useAuthForm } from './useAuthForm';
import { checkPassword } from './validateAuth';

interface SetNewPasswordProps {
  auth: AuthService;
  /** The reset link already signed this browser in, so "done" goes straight to the cards. */
  onDone(): void;
}

export function SetNewPassword({ auth, onDone }: SetNewPasswordProps) {
  const [password, setPassword] = useState('');
  const form = useAuthForm(
    () => ({ password: checkPassword(password, true) }),
    () => auth.setNewPassword(password),
  );

  return (
    <AuthLayout title="Choose a new password" subtitle="Use it to sign in on all your devices.">
      {form.done ? (
        <>
          <p role="status" className={styles.notice}>
            Password changed! On your other devices, sign in with the new one.
          </p>
          <Button onClick={onDone}>Go to my box</Button>
        </>
      ) : (
        <form className={styles.form} onSubmit={form.onSubmit} noValidate>
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={form.errors.password}
          />
          {form.formError && (
            <p role="alert" className={styles.formError}>
              {form.formError}
            </p>
          )}
          <div className={styles.actions}>
            <Button type="submit" aria-busy={form.busy}>
              {form.busy ? 'Saving…' : 'Save new password'}
            </Button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
