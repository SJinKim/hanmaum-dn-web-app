import { MemberSummary } from '../../core/models/member.model';

/**
 * The three options of the 순별 참석 현황 segmented control (Figma 188:169).
 * The backend counts one Sunday per request, so a range is N requests summed —
 * `hanmaum-dn-server` has no range endpoint yet.
 */
export type AttendanceRange = 'last-sunday' | 'last-4-weeks' | 'last-3-months';

/** The segmented control's order, left to right (Figma 188:169). */
export const ATTENDANCE_RANGES: readonly AttendanceRange[] = [
  'last-sunday',
  'last-4-weeks',
  'last-3-months',
];

/** How many Sundays each range covers. 3 months ≈ 13 Sundays. */
export const ATTENDANCE_RANGE_SUNDAYS: Record<AttendanceRange, number> = {
  'last-sunday': 1,
  'last-4-weeks': 4,
  'last-3-months': 13,
};

/** One 순 row: 순 / 참석 / 전체 / 비율. */
export interface GroupAttendanceRow {
  groupPublicId: string | null;
  groupName: string;
  /** Check-ins summed over every Sunday in the range. */
  attended: number;
  /** Roster size × Sundays in the range — the attendance *opportunities*. */
  total: number;
  /** 0–100, rounded. */
  ratio: number;
}

/**
 * A count Home could not load. Rendered as `—`, never as `0`: a 0 claims there
 * is nothing to do, which is wrong when the request simply failed (#93).
 */
export type HomeCount = number | null;

/** The 현황 card: 전체 청년 / 활동 청년 / 사역. */
export interface HomeOverview {
  totalMembers: HomeCount;
  activeMembers: HomeCount;
  ministries: HomeCount;
}

/** One 다가오는 일정 row — `daysUntil` renders as the D-N badge. */
export interface UpcomingEvent {
  publicId: string;
  title: string;
  daysUntil: number;
}

/** Everything Home loads in one pass, except the range-dependent 순별 참석 현황. */
export interface HomeSnapshot {
  pendingApprovals: HomeCount;
  awaitingRsvps: HomeCount;
  overview: HomeOverview;
  recentActivity: MemberSummary[];
  upcomingEvents: UpcomingEvent[];
}

/** `YYYY-MM-DD` in local time — `toISOString()` would shift the day in KST. */
export function toIsoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * The `count` most recent Sundays, newest first, counting today when today is a
 * Sunday — that service has already happened by the time anyone reads Home.
 */
export function recentSundays(count: number, now = new Date()): string[] {
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  sunday.setDate(sunday.getDate() - sunday.getDay());
  return Array.from({ length: count }, (_, week) => {
    const date = new Date(sunday);
    date.setDate(date.getDate() - week * 7);
    return toIsoDate(date);
  });
}

/** Whole days from `now` to `iso`, rounded up — 0 means today. */
export function daysUntil(iso: string, now = new Date()): number {
  const target = new Date(iso);
  const days = (target.getTime() - now.getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(days));
}

/** The 합계 row Figma puts at the foot of 순별 참석 현황. */
export function totalAttendanceRow(
  rows: readonly GroupAttendanceRow[],
  label = '합계',
): GroupAttendanceRow {
  const attended = rows.reduce((sum, row) => sum + row.attended, 0);
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  return {
    groupPublicId: null,
    groupName: label,
    attended,
    total,
    ratio: total > 0 ? Math.round((attended / total) * 100) : 0,
  };
}
