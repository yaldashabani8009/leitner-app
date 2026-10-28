import { useEffect, useMemo, useState } from 'react';
import type { AuthService, SessionClient } from '../data/auth';
import { openDatabase } from '../data/db';
import type { SyncRemote } from '../data/sync/remote';
import { useSync } from '../data/sync/useSync';
import { refreshProfile, type ProfileSource } from '../data/profileSync';
import { createRepository } from '../data/repository';
import { ForgotPassword } from '../screens/Auth/ForgotPassword';
import { SetNewPassword } from '../screens/Auth/SetNewPassword';
import { SignIn, type AuthScreen } from '../screens/Auth/SignIn';
import { SignUp } from '../screens/Auth/SignUp';
import { LoadingScreen } from '../screens/Loading/LoadingScreen';
import { StudyFlow } from '../screens/Study/StudyFlow';
import { readLastUser, writeLastUser } from './lastUser';
import { decideStart, settleWithin, START_TIMEOUT_MS } from './startup';

/** What the app needs from the outside world; main.tsx passes the Supabase-backed ones. */
export interface AppServices {
  session: SessionClient;
  auth: AuthService;
  profiles: ProfileSource;
  /** The cloud copy of the cards (sync, ADR-003). */
  remote: SyncRemote;
  fromRecoveryLink: boolean;
  /** Tests shorten this; see START_TIMEOUT_MS. */
  startTimeoutMs?: number;
  /** Tests pass 0; see MIN_LOADING_MS. */
  minLoadingMs?: number;
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
      return <LoadingScreen />;
    case 'app':
      return (
        <SignedIn
          key={view.userId}
          userId={view.userId}
          profiles={services.profiles}
          remote={services.remote}
          minLoadingMs={services.minLoadingMs}
        />
      );
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

interface SignedInProps {
  userId: string;
  profiles: ProfileSource;
  remote: SyncRemote;
  minLoadingMs?: number;
}

/** Opens this account's own on-device database (ADR-012), keeps it in sync and refreshes the profile copy. */
function SignedIn({ userId, profiles, remote, minLoadingMs }: SignedInProps) {
  const db = useMemo(() => openDatabase(userId), [userId]);
  const repo = useMemo(() => createRepository(db), [db]);
  useSync(db, remote);

  useEffect(() => {
    // Not a UI data read: copies the profile to the device; the screen reads it with useLiveQuery.
    void refreshProfile(profiles, repo, userId);
  }, [profiles, repo, userId]);

  return <StudyFlow repo={repo} minLoadingMs={minLoadingMs} />;
}
