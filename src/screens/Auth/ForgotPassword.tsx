import { useState } from 'react';
import type { AuthService } from '../../data/auth';
import { Button } from '../../ui/Button';
import { TextField } from '../../ui/TextField';
import styles from './Auth.module.css';
import { AuthLayout } from './AuthLayout';
import type { AuthScreen } from './SignIn';
import { useAuthForm } from './useAuthForm';
import { checkEmail } from './validateAuth';

interface ForgotPasswordProps {
  auth: AuthService;
  onNavigate(screen: AuthScreen): void;
}

export function ForgotPassword({ auth, onNavigate }: ForgotPasswordProps) {
  const [email, setEmail] = useState('');
  const form = useAuthForm(
    () => ({ email: checkEmail(email) }),
    () => auth.sendPasswordReset(email.trim()),
  );

  return (
    <AuthLayout title="Forgot password?" subtitle="We'll email you a link to choose a new one.">
      {form.done ? (
        // Supabase answers the same for unknown emails, so we don't claim the account exists.
        <p role="status" className={styles.notice}>
          If there's an account for {email.trim()}, a reset link is on its way. Open it, choose a
          new password, then sign in here with it.
        </p>
      ) : (
        <form className={styles.form} onSubmit={form.onSubmit} noValidate>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={form.errors.email}
          />
          {form.formError && (
            <p role="alert" className={styles.formError}>
              {form.formError}
            </p>
          )}
          <div className={styles.actions}>
            <Button type="submit" aria-busy={form.busy}>
              {form.busy ? 'Sending…' : 'Send reset link'}
            </Button>
          </div>
        </form>
      )}
      <div className={styles.links}>
        <Button variant="text" onClick={() => onNavigate('signIn')}>
          Back to sign in
        </Button>
      </div>
    </AuthLayout>
  );
}
