/**
 * 장기결석자 (#277) — the four operations under `/v1/attendance/long-absences`
 * (server #375, ops `api/openapi.yaml`). Every response field is required by the
 * spec; the nullable ones stay explicit `null`, never `undefined`.
 */

/** Server `LONG_ABSENCE_MEMO_MAX_LENGTH`, counted in UTF-16 code units (`string.length`). */
export const LONG_ABSENCE_MEMO_MAX = 2000;

export type PostAssignmentAttendance =
  | 'REGULAR'
  | 'OCCASIONAL'
  | 'WORSHIP_ONLY'
  | 'ABSENT_OVER_MONTH'
  | 'CHANGED_CHURCH'
  | 'RETURNED_OR_MOVED';

export interface LongAbsenceGroup {
  readonly publicId: string;
  readonly name: string;
  readonly division: string | null;
}

export interface LongAbsenceActor {
  readonly publicId: string;
  readonly fullName: string;
}

export interface LongAbsence {
  readonly memberPublicId: string;
  readonly fullName: string;
  readonly discriminator: string | null;
  readonly group: LongAbsenceGroup | null;
  /** ISO date of the last qualifying Sunday check-in; anchors the absence phase. */
  readonly lastSundayDate: string;
  /** ISO date, the day after `lastSundayDate`. */
  readonly absentSince: string;
  readonly absenceDays: number;
  /** Full calendar months; listed from 3, urgency steps at 6 and 12. */
  readonly absenceMonths: number;
  readonly postAssignmentAttendance: PostAssignmentAttendance | null;
  readonly contacted: boolean;
  /** Keycloak subject of the account that marked the phase as contacted. */
  readonly contactedBy: string | null;
  readonly contactedByMember: LongAbsenceActor | null;
  /** ISO instant. */
  readonly contactedAt: string | null;
  readonly memo: string | null;
  /** Sent back unchanged on writes; 0 while nothing was recorded for the phase. */
  readonly version: number;
}

export interface LongAbsenceSummary {
  /** Berlin calendar day the counts were taken on. */
  readonly asOfDate: string;
  readonly totalCount: number;
  readonly uncontactedCount: number;
  /** Not contacted and absent for at least six calendar months. */
  readonly atLeastSixMonthsCount: number;
}

/** `value: null` (or blank) clears the memo; a string replaces it. */
export interface LongAbsenceMemoUpdate {
  readonly value: string | null;
}

export interface LongAbsenceContactStatusRequest {
  readonly lastSundayDate: string;
  readonly version: number;
  readonly contacted: boolean;
  /** Omitted leaves the memo unchanged. */
  readonly memoUpdate?: LongAbsenceMemoUpdate;
}

export interface LongAbsenceMemoRequest {
  readonly lastSundayDate: string;
  readonly version: number;
  /** Required key: `null` or blank clears the memo. */
  readonly memo: string | null;
}

export type UrgencyLevel = 3 | 6 | 12;

/** 3–5 months amber, 6–11 orange, 12 and more red (Jin, 29.10.). */
export function urgencyLevel(months: number): UrgencyLevel {
  if (months >= 12) return 12;
  if (months >= 6) return 6;
  return 3;
}
