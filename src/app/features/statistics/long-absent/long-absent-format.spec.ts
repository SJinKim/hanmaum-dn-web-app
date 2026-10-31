import { longAbsenceFixture } from '../../../core/models/long-absent.fixtures.spec';
import { urgencyLevel } from '../../../core/models/long-absent.model';
import { contactActor, formatDay, memoLength, memoWithAddition } from './long-absent-format';

describe('long-absent format (#277)', () => {
  it('steps urgency at 6 and 12 months, both included', () => {
    expect([3, 5, 6, 11, 12, 14].map(urgencyLevel)).toEqual([3, 3, 6, 6, 12, 12]);
  });

  it('adds new details after a line break and keeps the existing memo', () => {
    expect(memoWithAddition('이사', '  다음 달 복귀 예정 ')).toBe('이사\n다음 달 복귀 예정');
    expect(memoWithAddition(null, '복귀 예정')).toBe('복귀 예정');
  });

  it('adds nothing for blank details, so the memo stays untouched', () => {
    expect(memoWithAddition('이사', '   ')).toBeNull();
    expect(memoWithAddition('이사', '')).toBeNull();
  });

  it('counts UTF-16 code units like the server — an emoji is two', () => {
    expect(memoLength('a'.repeat(2000))).toBe(2000);
    expect(memoLength('🙏')).toBe(2);
  });

  it('formats a calendar day without shifting it across a time zone', () => {
    expect(formatDay('2026-07-26', 'en-US')).toBe('07/26/2026');
    expect(formatDay('2026-01-01', 'en-US')).toBe('01/01/2026');
  });

  it('names the member behind the account, else the account, else nobody', () => {
    expect(contactActor(longAbsenceFixture({ contactedBy: 'sub', contactedByMember: { publicId: 'p', fullName: 'John Doe' } }))).toBe('John Doe');
    expect(contactActor(longAbsenceFixture({ contactedBy: 'sub', contactedByMember: null }))).toBe('sub');
    expect(contactActor(longAbsenceFixture())).toBeNull();
  });
});
