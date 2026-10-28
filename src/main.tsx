import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { App } from './app/App';
import { requestPersistentStorage } from './data/storage';
import {
  auth,
  openedFromRecoveryLink,
  profileSource,
  sessionClient,
  syncRemote,
} from './data/supabase';

const services = {
  session: sessionClient,
  auth,
  profiles: profileSource,
  remote: syncRemote,
  fromRecoveryLink: openedFromRecoveryLink,
};

// ADR-002: ask the browser to keep our data (matters most on iPhone).
void requestPersistentStorage();

const root = createRoot(document.getElementById('root')!);

// Roadmap 7.7: a gallery of the UI kit at ?kit, only on the dev server (never in the built site).
if (import.meta.env.DEV && new URLSearchParams(location.search).has('kit')) {
  void import('./dev/KitPage').then(({ KitPage }) =>
    root.render(
      <StrictMode>
        <KitPage />
      </StrictMode>,
    ),
  );
} else {
  root.render(
    <StrictMode>
      <App services={services} />
    </StrictMode>,
  );
}
