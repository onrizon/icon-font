/**
 * Single source of truth for the workspace domain gate in app code.
 * NOTE: firestore.rules duplicates this domain (rules cannot import code) —
 * keep the two in sync.
 */
export const ALLOWED_EMAIL_DOMAIN = 'onrizon.com.br';

export function isAllowedEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}
