import { useState } from 'react';
import type { AuthService } from '../../data/auth';
import { Button } from '../../ui/Button';
import { TextField } from '../../ui/TextField';
import styles from './Auth.module.css';
import { AuthLayout } from './AuthLayout';
import type { AuthScreen } from './SignIn';
import { useAuthForm } from './useAuthForm';
import { checkDisplayName, checkEmail, checkPassword } from './validateAuth';

interface SignUpProps {
  auth: AuthService;
  onNavigate(screen: AuthScreen): void;
}

/** The time zone is taken quietly from the phone (Yali's decision, 2026-10-28). */
export function SignUp({ auth, onNavigate }: SignUpProps) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const form = useAuthForm(
    () => ({
      displayName: checkDisplayName(displayName),
      email: checkEmail(email),
      password: checkPassword(password, true),
    }),
    () => auth.signUp({ displayName: displayName.trim(), email: email.trim(), password }),
  );

  return (
    <AuthLayout title="Make your box" subtitle="One account for all your devices.">
      {form.done ? (
        <p role="status" className={styles.notice}>
          Almost there! Check your inbox to confirm your email, then sign in.
        </p>
      ) : (
        <form className={styles.form} onSubmit={form.onSubmit} noValidate>
          <TextField
            label="Your name"
            autoComplete="given-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            error={form.errors.displayName}
          />
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
          <TextField
            label="Password"
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
              {form.busy ? 'Creating…' : 'Create account'}
            </Button>
          </div>
        </form>
      )}
      <div className={styles.links}>
        <Button variant="text" onClick={() => onNavigate('signIn')}>
          I already have an account
        </Button>
      </div>
    </AuthLayout>
  );
}
