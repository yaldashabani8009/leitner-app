import { describe, expect, it } from 'vitest';
import { checkDisplayName, checkEmail, checkPassword, collectErrors } from './validateAuth';

describe('auth form checks', () => {
  it.each([
    ['', 'Enter your email.'],
    ['   ', 'Enter your email.'],
    ['yali', "That doesn't look like an email."],
    ['yali@mail', "That doesn't look like an email."],
    ['ya li@mail.com', "That doesn't look like an email."],
    [' yali@mail.com ', undefined],
  ])('email "%s" → %s', (email, message) => {
    expect(checkEmail(email)).toBe(message);
  });

  it('password when signing in: only required', () => {
    expect(checkPassword('', false)).toBe('Enter your password.');
    expect(checkPassword('x', false)).toBeUndefined();
  });

  it('password when choosing one: at least 6 characters', () => {
    expect(checkPassword('', true)).toBe('Choose a password.');
    expect(checkPassword('12345', true)).toBe('At least 6 characters.');
    expect(checkPassword('123456', true)).toBeUndefined();
  });

  it('name: required and at most 40 characters', () => {
    expect(checkDisplayName('  ')).toBe('What should we call you?');
    expect(checkDisplayName('Yali')).toBeUndefined();
    expect(checkDisplayName('ی'.repeat(40))).toBeUndefined();
    expect(checkDisplayName('a'.repeat(41))).toBe('Keep it under 40 characters.');
  });

  it('collectErrors keeps only real messages', () => {
    expect(collectErrors({ email: undefined, password: 'Enter your password.' })).toEqual({
      password: 'Enter your password.',
    });
    expect(collectErrors({ email: undefined })).toEqual({});
  });
});
