import { FormControl } from '@angular/forms';
import { guideCountValidator, guideDateString, guideDateValue, guidePreviousWeek, parseGuideCount } from './guide-report.model';

describe('Guide report values', () => {
  it('keeps unknown and explicit zero distinct and rejects coercion and overflow', () => {
    expect(parseGuideCount('')).toBeNull(); expect(parseGuideCount('0')).toBe(0);
    expect(parseGuideCount('2147483647')).toBe(2147483647);
    for (const value of ['-1', '1.2', '1e2', ' 1', '2147483648', 'abc', true, 1, null]) {
      expect(parseGuideCount(value)).toBeUndefined();
      expect(guideCountValidator(new FormControl(value))).not.toBeNull();
    }
  });
  it('preserves calendar dates and uses exactly seven days across year and daylight-saving boundaries', () => {
    for (const value of ['2026-10-18', '2026-03-29', '0001-01-01', '9999-12-31']) expect(guideDateString(guideDateValue(value))).toBe(value);
    expect(guidePreviousWeek('2026-01-04')).toBe('2025-12-28');
    expect(guidePreviousWeek('2026-03-29')).toBe('2026-03-22');
    expect(guidePreviousWeek('0001-01-01')).toBeNull();
    expect(guideDateString(new Date('invalid'))).toBeNull();
  });
});
