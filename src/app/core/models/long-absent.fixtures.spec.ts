import { LongAbsence, LongAbsenceSummary } from './long-absent.model';

/** Placeholder people only (#277 AK 12): 홍길동, Max Mustermann, John Doe. */
export function longAbsenceFixture(overrides: Partial<LongAbsence> = {}): LongAbsence {
  return {
    memberPublicId: '00000000-0000-4000-8000-000000000001',
    fullName: '홍길동',
    discriminator: null,
    group: { publicId: '00000000-0000-4000-8000-0000000000a1', name: '다니엘 1순', division: '다니엘' },
    lastSundayDate: '2026-07-26',
    absentSince: '2026-07-27',
    absenceDays: 97,
    absenceMonths: 3,
    postAssignmentAttendance: null,
    contacted: false,
    contactedBy: null,
    contactedByMember: null,
    contactedAt: null,
    memo: null,
    version: 0,
    ...overrides,
  };
}

/** Three rows in server order: longest absence first. */
export function longAbsenceListFixture(): LongAbsence[] {
  return [
    longAbsenceFixture({
      memberPublicId: '00000000-0000-4000-8000-000000000003',
      fullName: 'John Doe',
      group: null,
      lastSundayDate: '2025-08-17',
      absentSince: '2025-08-18',
      absenceDays: 441,
      absenceMonths: 14,
    }),
    longAbsenceFixture({
      memberPublicId: '00000000-0000-4000-8000-000000000002',
      fullName: 'Max Mustermann',
      lastSundayDate: '2026-03-29',
      absentSince: '2026-03-30',
      absenceDays: 216,
      absenceMonths: 7,
      contacted: true,
      contactedBy: 'subject-1',
      contactedByMember: { publicId: '00000000-0000-4000-8000-0000000000b1', fullName: 'Max Mustermann' },
      contactedAt: '2026-10-20T09:30:00Z',
      memo: '직장 때문에 이사',
      version: 2,
    }),
    longAbsenceFixture(),
  ];
}

export function longAbsenceSummaryFixture(overrides: Partial<LongAbsenceSummary> = {}): LongAbsenceSummary {
  return { asOfDate: '2026-10-31', totalCount: 3, uncontactedCount: 2, atLeastSixMonthsCount: 1, ...overrides };
}
