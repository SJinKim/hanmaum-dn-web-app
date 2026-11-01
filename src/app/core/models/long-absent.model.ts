/**
 * 장기결석자 (#277, #279) — the operations under `/v1/attendance/long-absences`
 * (server #375 / #379, ops `api/openapi.yaml`). Every response field is required
 * by the spec; the nullable ones stay explicit `null`, never `undefined`.
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

export type LongAbsenceEndReason = 'CHECK_IN' | 'MANUAL_RETURN';

export interface LongAbsence {
  readonly memberPublicId: string;
  /** Stored phase of this absence; `null` while nothing was recorded for it (no history yet). */
  readonly phasePublicId: string | null;
  readonly fullName: string;
  readonly discriminator: string | null;
  readonly group: LongAbsenceGroup | null;
  /** ISO date of the last qualifying Sunday check-in; sent back unchanged on writes. */
  readonly lastSundayDate: string;
  /** ISO date the absence counts from: the later of `lastSundayDate` and a manual return. */
  readonly absenceAnchorDate: string;
  /** ISO date, the day after `absenceAnchorDate`. */
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
  /** Opaque conflict token; sent back unchanged on writes. */
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

/** Ends the current phase without a check-in; date and actor come from the server. */
export interface LongAbsenceReturnRequest {
  readonly lastSundayDate: string;
  readonly version: number;
}

/** The phase a manual return has just ended. */
export interface LongAbsenceReturn {
  readonly memberPublicId: string;
  readonly phasePublicId: string;
  readonly endedOn: string;
  readonly endReason: LongAbsenceEndReason;
  /** ISO instant. */
  readonly returnedAt: string;
  readonly returnedBy: string;
  readonly returnedByMember: LongAbsenceActor | null;
  readonly version: number;
}

/** Server page envelope of the history and the change list. */
export interface LongAbsencePage<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly size: number;
  readonly totalElements: number;
  readonly totalPages: number;
}

/** Metadata of a stored phase, shared by the history row and the phase detail. No memo. */
export interface LongAbsencePhaseMeta {
  readonly phasePublicId: string;
  readonly memberPublicId: string;
  /** Current name of the member. */
  readonly fullName: string;
  readonly discriminator: string | null;
  readonly lastSundayDate: string;
  readonly absenceAnchorDate: string;
  readonly absentSince: string;
  readonly contacted: boolean;
  readonly contactedBy: string | null;
  readonly contactedByMember: LongAbsenceActor | null;
  readonly contactedAt: string | null;
  /** Set for `MANUAL_RETURN` only. */
  readonly returnedAt: string | null;
  readonly returnedBy: string | null;
  readonly returnedByMember: LongAbsenceActor | null;
}

/** One closed phase of the global history table. */
export interface LongAbsenceHistoryItem extends LongAbsencePhaseMeta {
  readonly endedOn: string;
  readonly endReason: LongAbsenceEndReason;
}

/** One stored phase, open or closed, with its current memo. */
export interface LongAbsencePhase extends LongAbsencePhaseMeta {
  /** `null` while the phase is open. */
  readonly endedOn: string | null;
  readonly endReason: LongAbsenceEndReason | null;
  /** `null` when there is none or 90 days after the end — shown as empty, never as "deleted". */
  readonly memo: string | null;
  readonly isCurrent: boolean;
}

export type LongAbsenceChangeKind = 'CONTACT_CHANGED' | 'MEMO_CHANGED';
export type LongAbsenceChangeOrigin = 'ACTION' | 'LEGACY_SNAPSHOT';

/** One contact or memo change of a phase; only the payload of its kind is set. */
export interface LongAbsenceChange {
  readonly publicId: string;
  readonly revision: number;
  readonly kind: LongAbsenceChangeKind;
  readonly origin: LongAbsenceChangeOrigin;
  /** `null` for a legacy snapshot whose time is unknown. */
  readonly occurredAt: string | null;
  readonly actorSubject: string | null;
  readonly actorMember: LongAbsenceActor | null;
  readonly contacted: boolean | null;
  readonly memo: string | null;
}

/** Server limit of `size` on both paged endpoints. */
export const LONG_ABSENCE_PAGE_SIZE = 20;

export type UrgencyLevel = 3 | 6 | 12;

/** 3–5 months amber, 6–11 orange, 12 and more red (Jin, 29.10.). */
export function urgencyLevel(months: number): UrgencyLevel {
  if (months >= 12) return 12;
  if (months >= 6) return 6;
  return 3;
}
