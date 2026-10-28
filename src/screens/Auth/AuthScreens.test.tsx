// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AuthResult, AuthService } from '../../data/auth';
import { ForgotPassword } from './ForgotPassword';
import { SetNewPassword } from './SetNewPassword';
import { SignIn } from './SignIn';
import { SignUp } from './SignUp';

const ok: AuthResult = { ok: true };

function fakeAuth(result: AuthResult = ok) {
  return {
    signIn: vi.fn<AuthService['signIn']>(async () => result),
    signUp: vi.fn<AuthService['signUp']>(async () => result),
    sendPasswordReset: vi.fn<AuthService['sendPasswordReset']>(async () => result),
    setNewPassword: vi.fn<AuthService['setNewPassword']>(async () => result),
  } satisfies AuthService;
}

describe('Sign in', () => {
  it('shows an error under each empty field and does not call Supabase', async () => {
    const auth = fakeAuth();
    render(<SignIn auth={auth} onNavigate={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter your email.');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Enter your password.');
    expect(screen.getByLabelText('Email')).toBeInvalid();
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('signs in with the trimmed email', async () => {
    const auth = fakeAuth();
    render(<SignIn auth={auth} onNavigate={() => {}} />);
    await userEvent.type(screen.getByLabelText('Email'), ' yali@example.com ');
    await userEvent.type(screen.getByLabelText('Password'), 'secret1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(auth.signIn).toHaveBeenCalledWith('yali@example.com', 'secret1');
  });

  it('explains a wrong password above the button', async () => {
    const auth = fakeAuth({ ok: false, problem: 'wrongCredentials' });
    render(<SignIn auth={auth} onNavigate={() => {}} />);
    await userEvent.type(screen.getByLabelText('Email'), 'yali@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "That email and password don't match",
    );
  });

  it('says "Signing in…" while waiting and ignores extra taps', async () => {
    let finish: (result: AuthResult) => void = () => {};
    const auth = fakeAuth();
    auth.signIn.mockImplementation(() => new Promise<AuthResult>((resolve) => (finish = resolve)));
    render(<SignIn auth={auth} onNavigate={() => {}} />);
    await userEvent.type(screen.getByLabelText('Email'), 'yali@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    const busy = screen.getByRole('button', { name: 'Signing in…' });
    expect(busy).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(busy);
    expect(auth.signIn).toHaveBeenCalledTimes(1);
    finish(ok);
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('links to Forgot password and Create an account', async () => {
    const onNavigate = vi.fn();
    render(<SignIn auth={fakeAuth()} onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create an account' }));
    expect(onNavigate.mock.calls).toEqual([['forgotPassword'], ['signUp']]);
  });
});

describe('Sign up', () => {
  async function fillIn() {
    await userEvent.type(screen.getByLabelText('Your name'), ' Yali ');
    await userEvent.type(screen.getByLabelText('Email'), 'yali@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret1');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  }

  it('checks every field, including the 6-character password', async () => {
    const auth = fakeAuth();
    render(<SignUp auth={auth} onNavigate={() => {}} />);
    await userEvent.type(screen.getByLabelText('Password'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByLabelText('Your name')).toHaveAccessibleDescription(
      'What should we call you?',
    );
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('At least 6 characters.');
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('says politely that sign-ups are closed', async () => {
    render(
      <SignUp auth={fakeAuth({ ok: false, problem: 'signupsClosed' })} onNavigate={() => {}} />,
    );
    await fillIn();
    expect(await screen.findByRole('alert')).toHaveTextContent('Sign-ups are closed for now.');
  });

  it('puts "email already used" under the email field', async () => {
    render(<SignUp auth={fakeAuth({ ok: false, problem: 'emailTaken' })} onNavigate={() => {}} />);
    await fillIn();
    expect(await screen.findByLabelText('Email')).toHaveAccessibleDescription(
      "There's already an account with this email. Sign in instead?",
    );
  });

  it('sends the trimmed name and asks to confirm the email', async () => {
    const auth = fakeAuth();
    render(<SignUp auth={auth} onNavigate={() => {}} />);
    await fillIn();
    expect(auth.signUp).toHaveBeenCalledWith({
      displayName: 'Yali',
      email: 'yali@example.com',
      password: 'secret1',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Check your inbox');
  });

  it('links back to sign in', async () => {
    const onNavigate = vi.fn();
    render(<SignUp auth={fakeAuth()} onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('button', { name: 'I already have an account' }));
    expect(onNavigate).toHaveBeenCalledWith('signIn');
  });
});

describe('Forgot password', () => {
  it('sends the link and shows what happens next', async () => {
    const auth = fakeAuth();
    render(<ForgotPassword auth={auth} onNavigate={() => {}} />);
    await userEvent.type(screen.getByLabelText('Email'), 'yali@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(auth.sendPasswordReset).toHaveBeenCalledWith('yali@example.com');
    expect(await screen.findByRole('status')).toHaveTextContent(
      "If there's an account for yali@example.com, a reset link is on its way.",
    );
  });

  it('tells you when you are offline', async () => {
    render(
      <ForgotPassword auth={fakeAuth({ ok: false, problem: 'offline' })} onNavigate={() => {}} />,
    );
    await userEvent.type(screen.getByLabelText('Email'), 'yali@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("You're offline.");
  });

  it('links back to sign in', async () => {
    const onNavigate = vi.fn();
    render(<ForgotPassword auth={fakeAuth()} onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(onNavigate).toHaveBeenCalledWith('signIn');
  });
});

describe('Set new password', () => {
  it('puts "same as before" under the password field', async () => {
    render(
      <SetNewPassword auth={fakeAuth({ ok: false, problem: 'samePassword' })} onDone={() => {}} />,
    );
    await userEvent.type(screen.getByLabelText('New password'), 'secret1');
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(await screen.findByLabelText('New password')).toHaveAccessibleDescription(
      "That's your current password. Pick a new one.",
    );
  });

  it('saves, confirms, then goes to the box', async () => {
    const auth = fakeAuth();
    const onDone = vi.fn();
    render(<SetNewPassword auth={auth} onDone={onDone} />);
    await userEvent.type(screen.getByLabelText('New password'), 'newsecret');
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(auth.setNewPassword).toHaveBeenCalledWith('newsecret');
    expect(await screen.findByRole('status')).toHaveTextContent('Password changed!');
    await userEvent.click(screen.getByRole('button', { name: 'Go to my box' }));
    expect(onDone).toHaveBeenCalled();
  });
});
