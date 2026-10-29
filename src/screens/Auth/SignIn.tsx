import { useState } from 'react';
import { SIGNUPS_OPEN } from '../../app/features';
import type { AuthService } from '../../data/auth';
import { Button } from '../../ui/Button';
import { TextField } from '../../ui/TextField';
import styles from './Auth.module.css';
import { AuthLayout } from './AuthLayout';
import { useAuthForm } from './useAuthForm';
import { checkEmail, checkPassword } from './validateAuth';

export type AuthScreen = 'signIn' | 'signUp' | 'forgotPassword';

interface SignInProps {
  auth: AuthService;
  onNavigate(screen: AuthScreen): void;
  /** Shows "Create an account" (see app/features.ts). */
  signupsOpen?: boolean;
}

/** Success is picked up by the app's auth listener, which opens the cards. */
export function SignIn({ auth, onNavigate, signupsOpen = SIGNUPS_OPEN }: SignInProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const form = useAuthForm(
    () => ({ email: checkEmail(email), password: checkPassword(password, false) }),
    () => auth.signIn(email.trim(), password),
  );

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in once on this device and your box stays here."
    >
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
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
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
            {form.busy ? 'Signing in…' : 'Sign in'}
          </Button>
          <div className={styles.links}>
            <Button variant="text" onClick={() => onNavigate('forgotPassword')}>
              Forgot password?
            </Button>
            {signupsOpen && (
              <Button variant="text" onClick={() => onNavigate('signUp')}>
                Create an account
              </Button>
            )}
          </div>
        </div>
      </form>
    </AuthLayout>
  );
}
