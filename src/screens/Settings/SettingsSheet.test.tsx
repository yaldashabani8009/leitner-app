// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ReminderService, ReminderSettings } from '../../data/reminders';
import { SettingsSheet } from './SettingsSheet';

function service(stored: ReminderSettings | null = { reminderTime: '19:00', remindersOn: true }) {
  const saved: Partial<ReminderSettings>[] = [];
  let failing = false;
  const reminders: ReminderService = {
    publicKey: async () => null,
    save: async () => {},
    sendTest: async () => {},
    settings: async () => stored,
    saveSettings: async (_userId, change) => {
      if (failing) throw new Error('offline');
      saved.push(change);
    },
  };
  return { reminders, saved, fail: () => (failing = true) };
}

function show(reminders?: ReminderService) {
  const onSignOut = vi.fn();
  const onClose = vi.fn();
  render(
    <SettingsSheet
      open
      onClose={onClose}
      userId="u1"
      name="Yali"
      reminders={reminders}
      onSignOut={onSignOut}
    />,
  );
  return { onSignOut, onClose };
}

describe('SettingsSheet (canvas N13)', () => {
  it('shows the reminder switch and time from the profile, and who is signed in', async () => {
    const { reminders } = service({ reminderTime: '08:30', remindersOn: true });
    show(reminders);
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    const toggle = screen.getByRole('switch', { name: 'Daily reminder' });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Remind me at')).toHaveValue('08:30');
    expect(screen.getByText('One nudge when cards are waiting')).toBeInTheDocument();
    expect(screen.getByText('Signed in as Yali')).toBeInTheDocument();
  });

  it('switching off saves at once and greys out the time', async () => {
    const fake = service();
    show(fake.reminders);
    const toggle = screen.getByRole('switch', { name: 'Daily reminder' });
    await waitFor(() => expect(toggle).toBeEnabled());
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(fake.saved).toEqual([{ remindersOn: false }]);
    expect(screen.getByLabelText('Remind me at')).toBeDisabled();
  });

  it('a new time is saved in 15-minute steps', async () => {
    const fake = service();
    show(fake.reminders);
    const time = screen.getByLabelText('Remind me at');
    await waitFor(() => expect(time).toBeEnabled());
    fireEvent.change(time, { target: { value: '07:08' } });
    await waitFor(() => expect(fake.saved).toEqual([{ reminderTime: '07:15' }]));
    expect(time).toHaveValue('07:15');
    fireEvent.change(time, { target: { value: '' } }); // cleared: nothing saved
    expect(fake.saved).toHaveLength(1);
  });

  it('offline: says so, and a failed save puts the switch back', async () => {
    show(service(null).reminders);
    expect(await screen.findByRole('status')).toHaveTextContent("Couldn't reach your account");

    const fake = service();
    fake.fail();
    render(
      <SettingsSheet
        open
        onClose={() => {}}
        userId="u1"
        name={null}
        reminders={fake.reminders}
        onSignOut={() => {}}
      />,
    );
    const toggles = await screen.findAllByRole('switch', { name: 'Daily reminder' });
    const toggle = toggles[toggles.length - 1];
    await waitFor(() => expect(toggle).toBeEnabled());
    await userEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
    expect(screen.getByText('Signed in')).toBeInTheDocument();
  });

  it('Sign out, and no reminder rows without the reminder service', async () => {
    const { onSignOut } = show();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});
