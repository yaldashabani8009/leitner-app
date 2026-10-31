// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Speech, SpeechState } from '../../services/speech';
import { SpellingScreen } from './SpellingScreen';

function fakeSpeech(state: SpeechState = 'idle') {
  return {
    speak: vi.fn<Speech['speak']>(),
    state: () => state,
    subscribe: () => () => {},
    dispose: () => {},
  };
}

function setup(props: Partial<Parameters<typeof SpellingScreen>[0]> = {}) {
  const handlers = {
    onRecord: vi.fn(),
    onNext: vi.fn(),
    onStarted: vi.fn(),
  };
  const speech = fakeSpeech();
  const all = {
    cardId: 'c1',
    word: 'receive',
    kind: 'scheduled' as const,
    progress: 0.4,
    speech,
    needsStart: false,
    ...handlers,
    ...props,
  };
  const view = render(<SpellingScreen {...all} />);
  return { ...handlers, speech, all, view };
}

const field = () => screen.getByRole('textbox');
const type = (text: string) => userEvent.type(field(), text);

describe('SpellingScreen: listen and type (canvas P5)', () => {
  it('shows the speaker, the slow snail and an answer field set up for spelling', () => {
    setup();
    expect(screen.getByText('listen and type')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play the word again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play slowly' })).toBeInTheDocument();
    expect(screen.getByText('tap to hear it again')).toBeInTheDocument();
    expect(screen.getByText('Spelling')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
    const input = screen.getByRole('textbox', { name: 'Type what you hear' });
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input).toHaveAttribute('autocorrect', 'off');
    expect(input).toHaveAttribute('autocapitalize', 'off');
    expect(input).toHaveAttribute('spellcheck', 'false');
    expect(input).toHaveAttribute('enterkeyhint', 'go');
    expect(screen.getByRole('button', { name: 'Check' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show me' })).toBeInTheDocument();
  });

  it('the speaker says the word; the snail says it slowly', async () => {
    const { speech } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Play the word again' }));
    expect(speech.speak).toHaveBeenLastCalledWith('receive', { slow: false });
    await userEvent.click(screen.getByRole('button', { name: 'Play slowly' }));
    expect(speech.speak).toHaveBeenLastCalledWith('receive', { slow: true });
  });

  it('the first card of a session asks for one Start tap, which unlocks sound', async () => {
    const { speech, onStarted } = setup({ needsStart: true });
    expect(screen.getAllByText('Tap to start')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Tap to start' }));
    expect(speech.speak).toHaveBeenCalledWith('receive', { slow: false });
    expect(onStarted).toHaveBeenCalledOnce();
  });

  it('when sound is blocked the speaker says "Tap to hear"', () => {
    setup({ speech: fakeSpeech('blocked') });
    expect(screen.getByRole('button', { name: 'Tap to hear' })).toBeInTheDocument();
    expect(screen.getByText('Tap to hear', { selector: 'span' })).toBeInTheDocument();
  });

  it('a right answer (capitals and spaces ignored) is saved with what was typed and moves on', async () => {
    const { onRecord, onNext } = setup();
    await type('  Receive {Enter}');
    expect(onRecord).toHaveBeenCalledWith(true, 'Receive');
    expect(onNext).toHaveBeenCalledWith(true);
  });

  it('an empty answer does nothing', async () => {
    const { onRecord, onNext } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    await type('   {Enter}');
    expect(onRecord).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });
});

describe('SpellingScreen: not quite (canvas P6)', () => {
  it('saves the wrong answer, shows it over the word, and waits for one right retype', async () => {
    const { onRecord, onNext } = setup();
    await type('recieve{Enter}');
    expect(onRecord).toHaveBeenCalledWith(false, 'recieve');
    expect(onNext).not.toHaveBeenCalled();

    expect(screen.getByRole('region', { name: 'Not quite' })).toBeInTheDocument();
    expect(screen.getByText('not quite · back to the start')).toBeInTheDocument();
    expect(screen.getByText('you typed')).toBeInTheDocument();
    expect(screen.getByText('the word')).toBeInTheDocument();
    expect(
      screen.getByText('crossed out = extra letter · aqua = missing letter'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show me' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play the word again' })).toBeInTheDocument();

    const retype = screen.getByRole('textbox', { name: 'Type it once to go on' });
    expect(retype).toHaveValue('');
    expect(retype).toHaveFocus();
    await type('recieve{Enter}');
    expect(onNext).not.toHaveBeenCalled();
    expect(retype.className).toMatch(/shake/);

    await userEvent.clear(retype);
    await type('receive');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onNext).toHaveBeenCalledWith(false);
    expect(onRecord).toHaveBeenCalledOnce(); // the retype is never logged
  });

  it('marks extra and missing letters', async () => {
    setup({ word: 'necessary' });
    await type('neccesary{Enter}');
    const region = screen.getByRole('region', { name: 'Not quite' });
    expect(region.querySelectorAll('[class*="extra"]')).toHaveLength(1);
    expect(region.querySelectorAll('[class*="gap"]')).toHaveLength(1);
    expect(region.querySelectorAll('[class*="missing"]')).toHaveLength(1);
  });

  it('"Show me" counts as wrong and shows only the word', async () => {
    const { onRecord } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Show me' }));
    expect(onRecord).toHaveBeenCalledWith(false, null);
    expect(screen.getByText('receive')).toBeInTheDocument();
    expect(screen.queryByText('you typed')).not.toBeInTheDocument();
  });

  it('in a practice round the tag only says "not quite"', async () => {
    setup({ kind: 'practice' });
    await type('recieve{Enter}');
    expect(screen.getByText('not quite')).toBeInTheDocument();
  });

  it('a new card goes back to listen and type, with an empty field', async () => {
    const { all, view } = setup();
    await type('recieve{Enter}');
    view.rerender(<SpellingScreen {...all} cardId="c2" word="their" />);
    expect(screen.getByText('listen and type')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Type what you hear' })).toHaveValue('');
  });
});

describe('SpellingScreen: sounds the same (canvas P7)', () => {
  it('logs nothing until a way on is chosen; "count it" is right', async () => {
    const { onRecord, onNext } = setup({ word: 'their' });
    await type('there{Enter}');
    expect(onRecord).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: 'Sounds the same' })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Both are real words that sound alike, so you can't tell from the sound alone.",
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sounds the same, count it' }));
    expect(onRecord).toHaveBeenCalledWith(true, 'there');
    expect(onNext).toHaveBeenCalledWith(true);
  });

  it('typing the word instead counts as wrong', async () => {
    const { onRecord, onNext } = setup({ word: 'their' });
    await type('there{Enter}');
    await type('their{Enter}');
    expect(onRecord).toHaveBeenCalledWith(false, 'there');
    expect(onNext).toHaveBeenCalledWith(false);
  });
});
