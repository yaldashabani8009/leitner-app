import { useEffect, useMemo, useState } from 'react';
import type { AuthService, SessionClient } from '../data/auth';
import { openDatabase } from '../data/db';
import { refreshProfile, type ProfileSource } from '../data/profileSync';
import { createRepository } from '../data/repository';
import { ForgotPassword } from '../screens/Auth/ForgotPassword';
import { SetNewPassword } from '../screens/Auth/SetNewPassword';
import { SignIn, type AuthScreen } from '../screens/Auth/SignIn';
import { SignUp } from '../screens/Auth/SignUp';
import { PlaceholderHome } from '../screens/Home/PlaceholderHome';
import styles from './App.module.css';
import { readLastUser, writeLastUser } from './lastUser';
import { decideStart, settleWithin, START_TIMEOUT_MS } from './startup';

/** What the app needs from the outside world; main.tsx passes the Supabase-backed ones. */
export interface AppServices {
  session: SessionClient;
  auth: AuthService;
  profiles: ProfileSource;
  fromRecoveryLink: boolean;
  /** Tests shorten this; see START_TIMEOUT_MS. */
  startTimeoutMs?: number;
}

type View =
  | { kind: 'starting' }
  | { kind: 'app'; userId: string }
  | { kind: AuthScreen }
  | { kind: 'setNewPassword' };

export function App({ services }: { services: AppServices }) {
  const [view, setView] = useState<View>({ kind: 'starting' });

  useEffect(() => {
    let active = true;
    const loaded = settleWithin(
      services.session.load(),
      services.startTimeoutMs ?? START_TIMEOUT_MS,
      { userId: null, offline: true },
    );
    loaded.then(({ userId, offline }) => {
      if (!active) return;
      const start = decideStart({
        sessionUserId: userId,
        offline,
        lastUserId: readLastUser(),
        fromRecoveryLink: services.fromRecoveryLink,
      });
      if (userId) writeLastUser(userId);
      setView(start);
    });

    const unsubscribe = services.session.onChange((userId) => {
      writeLastUser(userId);
      setView((current) => {
        // The reset link signs the browser in; stay on "choose a new password" until it's saved.
        if (current.kind === 'setNewPassword') return current;
        return userId ? { kind: 'app', userId } : { kind: 'signIn' };
      });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [services]);

  switch (view.kind) {
    case 'starting':
      return <Starting />;
    case 'app':
      return <SignedIn key={view.userId} userId={view.userId} profiles={services.profiles} />;
    case 'setNewPassword':
      return (
        <SetNewPassword
          auth={services.auth}
          onDone={() =>
            services.session
              .load()
              .then(({ userId }) => setView(userId ? { kind: 'app', userId } : { kind: 'signIn' }))
          }
        />
      );
    case 'signUp':
      return <SignUp auth={services.auth} onNavigate={(kind) => setView({ kind })} />;
    case 'forgotPassword':
      return <ForgotPassword auth={services.auth} onNavigate={(kind) => setView({ kind })} />;
    case 'signIn':
      return <SignIn auth={services.auth} onNavigate={(kind) => setView({ kind })} />;
  }
}

/** Opens this account's own on-device database (ADR-012) and refreshes the profile copy. */
function SignedIn({ userId, profiles }: { userId: string; profiles: ProfileSource }) {
  const repo = useMemo(() => createRepository(openDatabase(userId)), [userId]);

  useEffect(() => {
    // Not a UI data read: copies the profile to the device; the screen reads it with useLiveQuery.
    void refreshProfile(profiles, repo, userId);
  }, [profiles, repo, userId]);

  return <PlaceholderHome repo={repo} />;
}

/** The split second while the saved session loads. The real Loading screen comes in roadmap 7.9. */
function Starting() {
  return (
    <main className={styles.screen} aria-busy="true">
      <p className={styles.title}>
        Leitner<span className={styles.dot}>.</span>
      </p>
    </main>
  );
}
