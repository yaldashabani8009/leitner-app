import { describe, expect, it, vi } from 'vitest';
import {
  createSpeech,
  NORMAL_RATE,
  pickVoice,
  SLOW_RATE,
  START_TIMEOUT_MS,
  type SpeechEnv,
} from './speech';

const voice = (name: string, lang: string, isDefault = false) => ({
  name,
  lang,
  default: isDefault,
});

describe('pickVoice (ADR-021)', () => {
  it('prefers an Enhanced or Premium en-US voice', () => {
    const voices = [
      voice('Samantha', 'en-US', true),
      voice('Daniel', 'en-GB'),
      voice('Ava (Enhanced)', 'en-US'),
    ];
    expect(pickVoice(voices)?.name).toBe('Ava (Enhanced)');
    expect(pickVoice([voice('Zoe (Premium)', 'en_US'), voice('A', 'en-US', true)])?.name).toBe(
      'Zoe (Premium)',
    );
  });

  it('then the default en-US voice, then any en-US, then any English, else none', () => {
    expect(pickVoice([voice('Fred', 'en-US'), voice('Samantha', 'en-US', true)])?.name).toBe(
      'Samantha',
    );
    expect(pickVoice([voice('Daniel', 'en-GB', true), voice('Fred', 'en-US')])?.name).toBe('Fred');
    expect(pickVoice([voice('Amélie', 'fr-CA'), voice('Daniel', 'en-GB')])?.name).toBe('Daniel');
    expect(pickVoice([voice('Amélie', 'fr-CA')])).toBeNull();
    expect(pickVoice([])).toBeNull();
  });
});

/** A fake browser: records what was spoken; the test decides when speech "starts". */
function fakeEnv(voices = [voice('Samantha', 'en-US', true)]) {
  let list: ReturnType<typeof voice>[] = [];
  const handlers = new Map<string, () => void>();
  const timers: (() => void)[] = [];
  let foreground: () => void = () => {};
  const spoken: SpeechSynthesisUtterance[] = [];
  const synth = {
    speak: vi.fn((u: SpeechSynthesisUtterance) => spoken.push(u)),
    cancel: vi.fn(),
    getVoices: () => list as unknown as SpeechSynthesisVoice[],
    addEventListener: (type: string, h: () => void) => handlers.set(type, h),
    removeEventListener: vi.fn((type: string) => handlers.delete(type)),
  };
  const env: SpeechEnv = {
    synth: synth as unknown as SpeechEnv['synth'],
    makeUtterance: (text) => ({ text }) as unknown as SpeechSynthesisUtterance,
    onBackToForeground: (listener) => {
      foreground = listener;
      return () => (foreground = () => {});
    },
    setTimeout: (callback) => timers.push(callback),
  };
  return {
    env,
    synth,
    spoken,
    loadVoices: () => {
      list = voices;
      handlers.get('voiceschanged')?.();
    },
    runTimers: () => timers.splice(0).forEach((t) => t()),
    backToForeground: () => foreground(),
    hasVoicesListener: () => handlers.has('voiceschanged'),
  };
}

describe('createSpeech (ADR-021)', () => {
  it('speaks in American English at the normal rate, cancelling first, with the voice once loaded', () => {
    const fake = fakeEnv();
    const speech = createSpeech(fake.env);
    speech.speak('receive');
    expect(fake.synth.cancel).toHaveBeenCalledBefore(fake.synth.speak);
    expect(fake.spoken[0]).toMatchObject({ text: 'receive', lang: 'en-US', rate: NORMAL_RATE });
    expect(fake.spoken[0].voice).toBeUndefined();

    fake.loadVoices(); // voiceschanged
    speech.speak('receive', { slow: true });
    expect(fake.spoken[1]).toMatchObject({ rate: SLOW_RATE });
    expect(fake.spoken[1].voice).toMatchObject({ name: 'Samantha' });
    expect(START_TIMEOUT_MS).toBe(1000);
  });

  it('speaking → idle when it ends; no start within a second → blocked (pulse "Tap to hear")', () => {
    const fake = fakeEnv();
    const speech = createSpeech(fake.env);
    const seen: string[] = [];
    speech.subscribe((state) => seen.push(state));

    speech.speak('one');
    fake.spoken[0].onstart!({} as SpeechSynthesisEvent);
    fake.runTimers();
    expect(speech.state()).toBe('speaking');
    fake.spoken[0].onend!({} as SpeechSynthesisEvent);
    expect(speech.state()).toBe('idle');

    speech.speak('two'); // the phone blocks it: no start event
    fake.runTimers();
    expect(speech.state()).toBe('blocked');
    expect(seen).toEqual(['speaking', 'idle', 'blocked']);
  });

  it('an error before starting is blocked too; events of an older word are ignored', () => {
    const fake = fakeEnv();
    const speech = createSpeech(fake.env);
    speech.speak('old');
    speech.speak('new');
    fake.spoken[0].onstart!({} as SpeechSynthesisEvent);
    fake.spoken[0].onend!({} as SpeechSynthesisEvent);
    fake.spoken[0].onerror!({} as SpeechSynthesisErrorEvent);
    expect(speech.state()).toBe('idle');
    fake.spoken[1].onerror!({} as SpeechSynthesisErrorEvent);
    expect(speech.state()).toBe('blocked');
    // An error after it started (e.g. cancelled by the next word) is not "blocked".
    speech.speak('third');
    fake.spoken[2].onstart!({} as SpeechSynthesisEvent);
    fake.spoken[2].onerror!({} as SpeechSynthesisErrorEvent);
    expect(speech.state()).toBe('speaking');
  });

  it('back from the background → blocked; dispose stops listening', () => {
    const fake = fakeEnv();
    const speech = createSpeech(fake.env);
    const listener = vi.fn();
    const unsubscribe = speech.subscribe(listener);
    fake.backToForeground();
    expect(speech.state()).toBe('blocked');
    fake.backToForeground(); // no change, no second call
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    speech.dispose();
    expect(fake.hasVoicesListener()).toBe(false);
  });
});
