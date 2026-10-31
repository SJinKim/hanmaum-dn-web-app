import {
  LongAbsence,
  LongAbsenceChange,
  LongAbsenceHistoryItem,
  LongAbsencePage,
  LongAbsencePhase,
  LongAbsenceReturn,
  LongAbsenceSummary,
} from './long-absent.model';

/** Placeholder people only (#277 AK 12): 홍길동, Max Mustermann, John Doe. */
export function longAbsenceFixture(overrides: Partial<LongAbsence> = {}): LongAbsence {
  return {
    memberPublicId: '00000000-0000-4000-8000-000000000001',
    phasePublicId: null,
    fullName: '홍길동',
    discriminator: null,
    group: { publicId: '00000000-0000-4000-8000-0000000000a1', name: '다니엘 1순', division: '다니엘' },
    lastSundayDate: '2026-07-26',
    absenceAnchorDate: '2026-07-26',
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
      absenceAnchorDate: '2025-08-17',
      absentSince: '2025-08-18',
      absenceDays: 441,
      absenceMonths: 14,
    }),
    longAbsenceFixture({
      memberPublicId: '00000000-0000-4000-8000-000000000002',
      fullName: 'Max Mustermann',
      phasePublicId: '00000000-0000-4000-8000-0000000000c2',
      lastSundayDate: '2026-03-29',
      absenceAnchorDate: '2026-03-29',
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

export function longAbsenceReturnFixture(overrides: Partial<LongAbsenceReturn> = {}): LongAbsenceReturn {
  return {
    memberPublicId: '00000000-0000-4000-8000-000000000001',
    phasePublicId: '00000000-0000-4000-8000-0000000000c1',
    endedOn: '2026-10-31',
    endReason: 'MANUAL_RETURN',
    returnedAt: '2026-10-31T10:00:00Z',
    returnedBy: 'subject-1',
    returnedByMember: { publicId: '00000000-0000-4000-8000-0000000000b1', fullName: 'Max Mustermann' },
    version: 1,
    ...overrides,
  };
}

export function longAbsenceHistoryItemFixture(overrides: Partial<LongAbsenceHistoryItem> = {}): LongAbsenceHistoryItem {
  return {
    phasePublicId: '00000000-0000-4000-8000-0000000000c1',
    memberPublicId: '00000000-0000-4000-8000-000000000001',
    fullName: '홍길동',
    discriminator: null,
    lastSundayDate: '2026-07-26',
    absenceAnchorDate: '2026-07-26',
    absentSince: '2026-07-27',
    endedOn: '2026-10-31',
    endReason: 'MANUAL_RETURN',
    contacted: true,
    contactedBy: 'subject-1',
    contactedByMember: { publicId: '00000000-0000-4000-8000-0000000000b1', fullName: 'Max Mustermann' },
    contactedAt: '2026-10-20T09:30:00Z',
    returnedAt: '2026-10-31T10:00:00Z',
    returnedBy: 'subject-1',
    returnedByMember: { publicId: '00000000-0000-4000-8000-0000000000b1', fullName: 'Max Mustermann' },
    ...overrides,
  };
}

export function longAbsencePhaseFixture(overrides: Partial<LongAbsencePhase> = {}): LongAbsencePhase {
  return { ...longAbsenceHistoryItemFixture(), memo: '직장 때문에 이사', isCurrent: false, ...overrides };
}

export function longAbsenceChangeFixture(overrides: Partial<LongAbsenceChange> = {}): LongAbsenceChange {
  return {
    publicId: '00000000-0000-4000-8000-0000000000d1',
    revision: 2,
    kind: 'MEMO_CHANGED',
    origin: 'ACTION',
    occurredAt: '2026-10-21T08:00:00Z',
    actorSubject: 'subject-1',
    actorMember: { publicId: '00000000-0000-4000-8000-0000000000b1', fullName: 'Max Mustermann' },
    contacted: null,
    memo: '직장 때문에 이사',
    ...overrides,
  };
}

export function pageFixture<T>(items: readonly T[], overrides: Partial<LongAbsencePage<T>> = {}): LongAbsencePage<T> {
  return { items, page: 0, size: 20, totalElements: items.length, totalPages: items.length ? 1 : 0, ...overrides };
}
