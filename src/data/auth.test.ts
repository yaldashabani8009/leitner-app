import { describe, expect, it, vi } from 'vitest';
import { AUTH_MESSAGES, createSupabaseAuth, problemFromError, type AuthProblem } from './auth';

const SITE = 'https://yaldashabani8009.github.io/leitner-app/';

describe('problemFromError', () => {
  it.each([
    ['invalid_credentials', 'wrongCredentials'],
    ['signup_disabled', 'signupsClosed'],
    ['user_already_exists', 'emailTaken'],
    ['email_exists', 'emailTaken'],
    ['weak_password', 'weakPassword'],
    ['same_password', 'samePassword'],
    ['email_not_confirmed', 'emailNotConfirmed'],
    ['over_email_send_rate_limit', 'tooManyTries'],
    ['over_request_rate_limit', 'tooManyTries'],
    ['something_new', 'unknown'],
  ] as const)('code %s → %s', (code, problem) => {
    expect(problemFromError({ name: 'AuthApiError', code })).toBe(problem);
  });

  it('no connection → offline', () => {
    expect(problemFromError({ name: 'AuthRetryableFetchError' })).toBe('offline');
  });

  it('an error without a code → unknown', () => {
    expect(problemFromError({ name: 'AuthUnknownError' })).toBe('unknown');
  });

  it('has a friendly message for every problem', () => {
    const problems = Object.keys(AUTH_MESSAGES) as AuthProblem[];
    expect(problems).toHaveLength(9);
    for (const problem of problems) expect(AUTH_MESSAGES[problem].length).toBeGreaterThan(10);
  });
});

function fakeClient(error: { name?: string; code?: string } | null = null) {
  const reply = async () => ({ data: {}, error });
  return {
    signInWithPassword: vi.fn(reply),
    signUp: vi.fn(reply),
    resetPasswordForEmail: vi.fn(reply),
    updateUser: vi.fn(reply),
    signOut: vi.fn(async () => ({ error: null })),
  };
}

type FakeClient = ReturnType<typeof fakeClient>;
const make = (client: FakeClient, zone = () => 'Asia/Tehran') =>
  // The fake only implements what the service calls.
  createSupabaseAuth(client as unknown as Parameters<typeof createSupabaseAuth>[0], SITE, zone);

describe('createSupabaseAuth', () => {
  it('signs in with email and password', async () => {
    const client = fakeClient();
    expect(await make(client).signIn('yali@example.com', 'secret1')).toEqual({ ok: true });
    expect(client.signInWithPassword).toHaveBeenCalledWith({
      email: 'yali@example.com',
      password: 'secret1',
    });
  });

  it('reports a wrong password as a problem, not a crash', async () => {
    const client = fakeClient({ name: 'AuthApiError', code: 'invalid_credentials' });
    expect(await make(client).signIn('a@b.co', 'x')).toEqual({
      ok: false,
      problem: 'wrongCredentials',
    });
  });

  it('sign-up sends the name and the phone time zone for the profile row', async () => {
    const client = fakeClient();
    await make(client, () => 'America/New_York').signUp({
      email: 'a@b.co',
      password: 'secret1',
      displayName: 'Yali',
    });
    expect(client.signUp).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'secret1',
      options: {
        emailRedirectTo: SITE,
        data: { display_name: 'Yali', time_zone: 'America/New_York' },
      },
    });
  });

  it('password reset links back to the site', async () => {
    const client = fakeClient();
    await make(client).sendPasswordReset('a@b.co');
    expect(client.resetPasswordForEmail).toHaveBeenCalledWith('a@b.co', { redirectTo: SITE });
  });

  it('sets a new password', async () => {
    const client = fakeClient();
    expect(await make(client).setNewPassword('newsecret')).toEqual({ ok: true });
    expect(client.updateUser).toHaveBeenCalledWith({ password: 'newsecret' });
  });

  it('a network failure that throws counts as offline', async () => {
    const client = fakeClient();
    client.signInWithPassword.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await make(client).signIn('a@b.co', 'x')).toEqual({ ok: false, problem: 'offline' });
  });

  it('uses the device time zone by default', () => {
    expect(() => createSupabaseAuth(fakeClient() as never, SITE)).not.toThrow();
  });
});

describe('signOut', () => {
  it('signs out on this device only', async () => {
    const client = fakeClient();
    await make(client).signOut();
    expect(client.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
