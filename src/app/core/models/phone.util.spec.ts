import {
  stripToDigits,
  isValidMobile,
  normalizeToE164,
  parseE164,
  formatForDisplay,
  PHONE_COUNTRIES,
} from './phone.util';

describe('phone.util', () => {
  describe('PHONE_COUNTRIES', () => {
    it('offers Germany and Korea with dial codes', () => {
      expect(PHONE_COUNTRIES.map(c => c.value)).toEqual(['DE', 'KR']);
      expect(PHONE_COUNTRIES.find(c => c.value === 'DE')!.dialCode).toBe('+49');
      expect(PHONE_COUNTRIES.find(c => c.value === 'KR')!.dialCode).toBe('+82');
    });
  });

  describe('stripToDigits', () => {
    it('removes spaces, dashes, parens and dots', () => {
      expect(stripToDigits('0151 (234) 56-78.9')).toBe('015123456789');
    });

    it('keeps only digits', () => {
      expect(stripToDigits('+49 0151-2345678')).toBe('4901512345678');
    });

    it('returns empty string for no digits', () => {
      expect(stripToDigits('  --  ')).toBe('');
    });
  });

  describe('isValidMobile', () => {
    it('accepts a valid German mobile with leading 0', () => {
      expect(isValidMobile('DE', '0151 2345678')).toBe(true);
    });

    it('accepts a valid German mobile without leading 0', () => {
      expect(isValidMobile('DE', '1512345678')).toBe(true);
    });

    it('accepts German 016x and 017x prefixes', () => {
      expect(isValidMobile('DE', '0160 1234567')).toBe(true);
      expect(isValidMobile('DE', '0171 2345678')).toBe(true);
    });

    it('rejects a German landline (030...)', () => {
      expect(isValidMobile('DE', '030 12345678')).toBe(false);
    });

    it('rejects a too-short German number', () => {
      expect(isValidMobile('DE', '0151 234')).toBe(false);
    });

    it('accepts a valid Korean mobile (010)', () => {
      expect(isValidMobile('KR', '010 1234 5678')).toBe(true);
    });

    it('accepts a valid Korean mobile without leading 0', () => {
      expect(isValidMobile('KR', '10 1234 5678')).toBe(true);
    });

    it('rejects a Korean landline (02...)', () => {
      expect(isValidMobile('KR', '02 1234 5678')).toBe(false);
    });

    it('rejects a too-long Korean number', () => {
      expect(isValidMobile('KR', '010 1234 56789')).toBe(false);
    });

    it('tolerates separators when validating', () => {
      expect(isValidMobile('DE', '0151-234-56-78')).toBe(true);
    });
  });

  describe('normalizeToE164', () => {
    it('builds E.164 from a German number with leading 0', () => {
      expect(normalizeToE164('DE', '0151 2345678')).toBe('+491512345678');
    });

    it('builds E.164 from a Korean number with leading 0', () => {
      expect(normalizeToE164('KR', '010 1234 5678')).toBe('+821012345678');
    });

    it('strips a single leading zero only', () => {
      expect(normalizeToE164('DE', '0151')).toBe('+49151');
    });

    it('returns null for empty input', () => {
      expect(normalizeToE164('DE', '')).toBeNull();
      expect(normalizeToE164('DE', '   ')).toBeNull();
    });
  });

  describe('parseE164', () => {
    it('splits a German E.164 number and re-adds leading 0', () => {
      expect(parseE164('+491512345678')).toEqual({ country: 'DE', local: '01512345678' });
    });

    it('splits a Korean E.164 number and re-adds leading 0', () => {
      expect(parseE164('+821012345678')).toEqual({ country: 'KR', local: '01012345678' });
    });

    it('round-trips with normalizeToE164', () => {
      const e164 = normalizeToE164('DE', '0151 2345678')!;
      const { country, local } = parseE164(e164);
      expect(normalizeToE164(country, local)).toBe(e164);
    });

    it('falls back to DE for null or unrecognized input', () => {
      expect(parseE164(null)).toEqual({ country: 'DE', local: '' });
      expect(parseE164('12345')).toEqual({ country: 'DE', local: '12345' });
    });
  });

  describe('formatForDisplay', () => {
    it('returns a dash for null or empty', () => {
      expect(formatForDisplay(null)).toBe('—');
      expect(formatForDisplay('')).toBe('—');
    });

    it('groups a German E.164 number', () => {
      expect(formatForDisplay('+491512345678')).toBe('+49 151 2345678');
    });

    it('groups a Korean E.164 number', () => {
      expect(formatForDisplay('+821012345678')).toBe('+82 10 12345678');
    });

    it('returns unrecognized values unchanged', () => {
      expect(formatForDisplay('12345')).toBe('12345');
    });
  });
});
