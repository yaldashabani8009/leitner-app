/**
 * Saying spelling words (v3 brief 1.3, ADR-021): the phone's built-in voice through the Web
 * Speech API, American English, free and offline.
 *
 * iPhone only lets a page start sound from a user's touch. So `speak()` must be called
 * synchronously inside the tap / key / swipe handler that asks for the word, never in a
 * useEffect after render or after a setTimeout (the delay can lose the permission). If speech
 * doesn't start within about a second, or the app comes back from the background, the state
 * becomes "blocked" and the screen shows a gently pulsing "Tap to hear" speaker.
 */

/** Normal and slow ("snail") speaking rates. */
export const NORMAL_RATE = 0.9;
export const SLOW_RATE = 0.55;
/** No `start` event within this long: the phone blocked the sound. */
export const START_TIMEOUT_MS = 1000;

export type SpeechState = 'idle' | 'speaking' | 'blocked';

interface VoiceLike {
  name: string;
  lang: string;
  default: boolean;
}

/**
 * The voice: an en-US "Enhanced" or "Premium" one, else the default en-US voice, else any en-US,
 * else any English voice. Null when there is none (the browser then uses its own default).
 */
export function pickVoice<V extends VoiceLike>(voices: readonly V[]): V | null {
  const lang = (voice: V) => voice.lang.replace('_', '-').toLowerCase();
  const us = voices.filter((voice) => lang(voice) === 'en-us');
  return (
    us.find((voice) => /enhanced|premium/i.test(voice.name)) ??
    us.find((voice) => voice.default) ??
    us[0] ??
    voices.find((voice) => lang(voice).startsWith('en')) ??
    null
  );
}

/** What the speech service needs from the browser (tests pass fakes). */
export interface SpeechEnv {
  synth: Pick<
    SpeechSynthesis,
    'speak' | 'cancel' | 'getVoices' | 'addEventListener' | 'removeEventListener'
  >;
  makeUtterance: (text: string) => SpeechSynthesisUtterance;
  /** The page went to the background and came back. Returns an unsubscribe function. */
  onBackToForeground: (listener: () => void) => () => void;
  setTimeout: (callback: () => void, ms: number) => unknown;
}

export interface Speech {
  /** Call straight from the user's tap / key / swipe. Cancels anything still speaking. */
  speak(text: string, options?: { slow?: boolean }): void;
  /** The current state, for the speaker button. */
  state(): SpeechState;
  subscribe(listener: (state: SpeechState) => void): () => void;
  /** Stop listening to the browser (tests, sign out). */
  dispose(): void;
}

export function createSpeech(env: SpeechEnv): Speech {
  let voice: SpeechSynthesisVoice | null = null;
  let current: SpeechState = 'idle';
  const listeners = new Set<(state: SpeechState) => void>();
  let attempt = 0;

  const set = (state: SpeechState) => {
    if (state === current) return;
    current = state;
    for (const listener of listeners) listener(state);
  };

  const loadVoices = () => {
    voice = pickVoice(env.synth.getVoices());
  };
  loadVoices();
  // iPhone and Chrome fill the list a moment later.
  env.synth.addEventListener('voiceschanged', loadVoices);
  // Back from the background: iPhone forgets the permission, so ask for a tap again.
  const stopForeground = env.onBackToForeground(() => set('blocked'));

  return {
    speak(text, options = {}) {
      env.synth.cancel();
      const utterance = env.makeUtterance(text);
      utterance.lang = 'en-US';
      if (voice) utterance.voice = voice;
      utterance.rate = options.slow ? SLOW_RATE : NORMAL_RATE;
      const mine = (attempt += 1);
      let started = false;
      utterance.onstart = () => {
        started = true;
        if (mine === attempt) set('speaking');
      };
      utterance.onend = () => {
        if (mine === attempt) set('idle');
      };
      utterance.onerror = () => {
        if (mine === attempt && !started) set('blocked');
      };
      env.synth.speak(utterance);
      env.setTimeout(() => {
        if (mine === attempt && !started) set('blocked');
      }, START_TIMEOUT_MS);
    },
    state: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      env.synth.removeEventListener('voiceschanged', loadVoices);
      stopForeground();
      listeners.clear();
    },
  };
}

/** The browser's speech, or null where there is none (old browsers, tests). */
export function browserSpeech(): Speech | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  return createSpeech({
    synth: window.speechSynthesis,
    makeUtterance: (text) => new SpeechSynthesisUtterance(text),
    onBackToForeground: (listener) => {
      const onChange = () => {
        if (document.visibilityState === 'visible') listener();
      };
      document.addEventListener('visibilitychange', onChange);
      return () => document.removeEventListener('visibilitychange', onChange);
    },
    setTimeout: (callback, ms) => window.setTimeout(callback, ms),
  });
}
