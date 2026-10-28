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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App services={services} />
  </StrictMode>,
);
