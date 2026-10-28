/** Quick checks before talking to Supabase, so errors show under the right field straight away. */

export const MIN_PASSWORD_LENGTH = 6; // Supabase's default minimum
export const MAX_NAME_LENGTH = 40; // profiles.display_name check in the database

export type AuthField = 'email' | 'password' | 'displayName';
export type AuthFieldErrors = Partial<Record<AuthField, string>>;

export function checkEmail(email: string): string | undefined {
  const value = email.trim();
  if (value === '') return 'Enter your email.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "That doesn't look like an email.";
  return undefined;
}

/** `isNew`: choosing a password (sign up, new password), so the minimum length applies. */
export function checkPassword(password: string, isNew: boolean): string | undefined {
  if (password === '') return isNew ? 'Choose a password.' : 'Enter your password.';
  if (isNew && password.length < MIN_PASSWORD_LENGTH) {
    return `At least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return undefined;
}

export function checkDisplayName(name: string): string | undefined {
  const value = name.trim();
  if (value === '') return 'What should we call you?';
  if ([...value].length > MAX_NAME_LENGTH) return `Keep it under ${MAX_NAME_LENGTH} characters.`;
  return undefined;
}

/** Drops fields without an error; empty object = all good. */
export function collectErrors(errors: AuthFieldErrors): AuthFieldErrors {
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => message));
}
