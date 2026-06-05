/**
 * Phone number helpers for the member form. Two countries only (Germany, Korea),
 * mobile numbers only. Numbers are stored in the `phoneNumber` field as E.164
 * (e.g. +491512345678) — no separators, no backend change required.
 */

export type PhoneCountry = 'DE' | 'KR';

export interface PhoneCountryOption {
  label: string;        // e.g. '🇩🇪 +49'
  value: PhoneCountry;
  dialCode: string;     // e.g. '+49'
}

interface CountryRule {
  dialCode: string;
  /** Matches the national number (leading 0 already stripped). */
  mobile: RegExp;
  /** How many leading national digits form the "prefix" group when displaying. */
  displayPrefixLen: number;
}

const RULES: Record<PhoneCountry, CountryRule> = {
  DE: { dialCode: '+49', mobile: /^1[567]\d{8,9}$/, displayPrefixLen: 3 },
  KR: { dialCode: '+82', mobile: /^1[016789]\d{7,8}$/, displayPrefixLen: 2 },
};

export const PHONE_COUNTRIES: PhoneCountryOption[] = [
  { label: '🇩🇪 +49', value: 'DE', dialCode: RULES.DE.dialCode },
  { label: '🇰🇷 +82', value: 'KR', dialCode: RULES.KR.dialCode },
];

/** Keeps only digits, dropping spaces, dashes, parens, dots, etc. */
export function stripToDigits(input: string): string {
  return (input ?? '').replace(/\D/g, '');
}

/** National number = digits with a single leading 0 removed. */
function toNational(localInput: string): string {
  return stripToDigits(localInput).replace(/^0/, '');
}

/** True when the local input is a valid mobile number for the country. */
export function isValidMobile(country: PhoneCountry, localInput: string): boolean {
  return RULES[country].mobile.test(toNational(localInput));
}

/** Assembles an E.164 string, or null when there are no digits. */
export function normalizeToE164(country: PhoneCountry, localInput: string): string | null {
  const national = toNational(localInput);
  if (!national) return null;
  return RULES[country].dialCode + national;
}

/** Splits a stored E.164 value into country + local (leading 0 re-added). */
export function parseE164(stored: string | null): { country: PhoneCountry; local: string } {
  if (stored) {
    for (const country of Object.keys(RULES) as PhoneCountry[]) {
      const { dialCode } = RULES[country];
      if (stored.startsWith(dialCode)) {
        return { country, local: '0' + stored.slice(dialCode.length) };
      }
    }
  }
  return { country: 'DE', local: stored ?? '' };
}

/** Human-readable form for read-only display, e.g. +49 151 2345678. */
export function formatForDisplay(stored: string | null): string {
  if (!stored) return '—';
  for (const country of Object.keys(RULES) as PhoneCountry[]) {
    const { dialCode, displayPrefixLen } = RULES[country];
    if (stored.startsWith(dialCode)) {
      const national = stored.slice(dialCode.length);
      const prefix = national.slice(0, displayPrefixLen);
      const rest = national.slice(displayPrefixLen);
      return `${dialCode} ${prefix} ${rest}`.trim();
    }
  }
  return stored;
}
