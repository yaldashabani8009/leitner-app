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
} else {
  root.render(
    <StrictMode>
      <App services={services} />
    </StrictMode>,
  );
}
