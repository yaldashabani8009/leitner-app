import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { App } from './app/App';
import { requestPersistentStorage } from './data/storage';
import {
  auth,
  openedFromRecoveryLink,
  profileSource,
  reminders,
  sessionClient,
  syncRemote,
} from './data/supabase';

const services = {
  session: sessionClient,
  auth,
  profiles: profileSource,
  remote: syncRemote,
  reminders,
  fromRecoveryLink: openedFromRecoveryLink,
};

// ADR-002: ask the browser to keep our data (matters most on iPhone).
void requestPersistentStorage();

const root = createRoot(document.getElementById('root')!);

// Dev server only (never in the built site): the UI kit gallery at ?kit (roadmap 7.7) and the
// study screens with sample words at ?demo (roadmap 7.9).
const devPage = import.meta.env.DEV ? new URLSearchParams(location.search) : null;
if (devPage?.has('kit')) {
  void import('./dev/KitPage').then(({ KitPage }) =>
    root.render(
      <StrictMode>
        <KitPage />
      </StrictMode>,
    ),
  );
} else if (devPage?.has('demo')) {
  void import('./dev/DemoPage').then(({ DemoPage }) =>
    root.render(
      <StrictMode>
        <DemoPage />
      </StrictMode>,
    ),
  );
} else if (import.meta.env.MODE === 'e2e') {
  // End-to-end test build only (roadmap 7.14, ADR-017): the cloud is an in-memory stand-in.
  // Vite drops this branch, and the file it loads, from the published site.
  void import('./e2e/fakeServices').then(({ createE2EServices }) =>
    root.render(
      <StrictMode>
        <App services={createE2EServices()} />
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
