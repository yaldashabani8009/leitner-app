import { useState, type FormEvent } from 'react';
import { AUTH_MESSAGES, type AuthProblem, type AuthResult } from '../../data/auth';
import { collectErrors, type AuthField, type AuthFieldErrors } from './validateAuth';

/** Problems that belong under one field; everything else is shown for the whole form. */
const FIELD_OF: Partial<Record<AuthProblem, AuthField>> = {
  emailTaken: 'email',
  weakPassword: 'password',
  samePassword: 'password',
};

/**
 * Shared form logic: check fields, call the service once (extra taps are ignored while busy),
 * and place each problem under its field or above the button.
 */
export function useAuthForm(
  check: () => AuthFieldErrors,
  submit: () => Promise<AuthResult>,
  onSuccess?: () => void,
) {
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const fieldErrors = collectErrors(check());
    setErrors(fieldErrors);
    setFormError(null);
    if (Object.keys(fieldErrors).length > 0) return;

    setBusy(true);
    const result = await submit();
    setBusy(false);
    if (result.ok) {
      setDone(true);
      onSuccess?.();
      return;
    }
    const field = FIELD_OF[result.problem];
    if (field) setErrors({ [field]: AUTH_MESSAGES[result.problem] });
    else setFormError(AUTH_MESSAGES[result.problem]);
  }

  return { errors, formError, busy, done, onSubmit };
}
