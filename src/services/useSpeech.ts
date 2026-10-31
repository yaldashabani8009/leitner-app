import { useSyncExternalStore } from 'react';
import { browserSpeech, type Speech, type SpeechState } from './speech';

let shared: Speech | null | undefined;

/** One speech service for the whole app (the voice is picked once). */
export function appSpeech(): Speech | null {
  if (shared === undefined) shared = browserSpeech();
  return shared;
}

const noState = (): SpeechState => 'idle';
const noSubscribe = () => () => {};

/** The speech service's state, for the speaker button ("blocked" → pulsing "Tap to hear"). */
export function useSpeechState(speech: Speech | null): SpeechState {
  return useSyncExternalStore(
    speech ? (listener) => speech.subscribe(listener) : noSubscribe,
    speech ? speech.state : noState,
  );
}
