import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { MemberSummary } from '../../core/models/member.model';
import { AttendanceGroupCountsResponse } from '../attendance/attendance.model';
import { AttendanceService } from '../attendance/attendance.service';
import { EventRsvpDto } from '../event-rsvps/event-rsvp.model';
import { EventRsvpService } from '../event-rsvps/event-rsvp.service';
import { MemberService } from '../members/member.service';
import { MinistryService } from '../ministry/ministry.service';
import {
  ATTENDANCE_RANGE_SUNDAYS,
  AttendanceRange,
  GroupAttendanceRow,
  HomeSnapshot,
  UpcomingEvent,
  daysUntil,
  recentSundays,
} from './home.model';

/** One page of members big enough to stand in for "all of them". */
const ROSTER_PAGE_SIZE = 9999;

/** How many members 최근 활동 pulls before sorting by `updatedAt` client-side. */
const RECENT_ACTIVITY_POOL = 50;

/** Rows Figma shows in 최근 활동 and 다가오는 일정. */
const RECENT_ACTIVITY_ROWS = 5;
const UPCOMING_EVENT_ROWS = 3;

/**
 * The Home data layer. Every call is an endpoint that exists in
 * `../hanmaum-dn-ops/api/openapi.yaml` today — see issue #52 for the audit and
 * for the four gaps this composes around (group roster size, multi-week
 * attendance ranges, a recent-activity feed, and an admin-wide 응답 대기 count).
 *
 * Nothing here filters by 순: `RoleService.homeBlockScope()` reports `own-group`
 * for a 순장, but the scoping needs Keycloak group membership (#47), so the
 * service still answers for the whole church.
 */
@Injectable({ providedIn: 'root' })
export class HomeService {
  private readonly members = inject(MemberService);
  private readonly ministries = inject(MinistryService);
  private readonly attendance = inject(AttendanceService);
  private readonly rsvps = inject(EventRsvpService);

  /** Everything except 순별 참석 현황, which depends on the selected range. */
  loadSnapshot(now = new Date()): Observable<HomeSnapshot> {
    return forkJoin({
      pending: this.members.getMembers({ status: 'PENDING', size: 1 }),
      total: this.members.getMembers({ size: 1 }),
      active: this.members.getMembers({ status: 'ACTIVE', size: 1 }),
      ministries: this.ministries.getMinistries(true),
      activeRsvps: this.rsvps.getActiveRsvps(),
      events: this.rsvps.getRsvps(),
      // No `sort` — the server ignores it (hanmaum-dn-server#196); `sortByUpdatedAt`
      // below does the ordering over the pool this fetches.
      recent: this.members.getMembers({ size: RECENT_ACTIVITY_POOL }),
    }).pipe(
      map(({ pending, total, active, ministries, activeRsvps, events, recent }) => ({
        pendingApprovals: pending.totalElements,
        // `myStatus === null` is the caller's own 응답 대기; there is no
        // church-wide "who has not answered" count yet.
        awaitingRsvps: activeRsvps.filter(rsvp => rsvp.myStatus === null).length,
        overview: {
          totalMembers: total.totalElements,
          activeMembers: active.totalElements,
          ministries: ministries.length,
        },
        recentActivity: sortByUpdatedAt(recent.content).slice(0, RECENT_ACTIVITY_ROWS),
        upcomingEvents: toUpcomingEvents(events, now),
      })),
    );
  }

  /**
   * 순별 참석 현황 for one range. 참석 is summed check-ins, 전체 is the ACTIVE
   * roster multiplied by the Sundays counted, so 비율 reads as an average rate.
   */
  loadGroupAttendance(
    range: AttendanceRange,
    now = new Date(),
  ): Observable<GroupAttendanceRow[]> {
    const sundays = recentSundays(ATTENDANCE_RANGE_SUNDAYS[range], now);
    return forkJoin({
      roster: this.members
        .getMembers({ status: 'ACTIVE', size: ROSTER_PAGE_SIZE })
        .pipe(map(page => page.content)),
      definitions: this.attendance.getDefinitions(true),
    }).pipe(
      switchMap(({ roster, definitions }) => {
        const sundayService =
          definitions.find(definition => definition.dayOfWeek === 'SUNDAY') ?? definitions[0];
        if (!sundayService) {
          return of(buildAttendanceRows(roster, [], sundays.length));
        }
        return forkJoin(
          sundays.map(date =>
            this.attendance.getGroupCounts({ definitionId: sundayService.publicId, date }),
          ),
        ).pipe(map(counts => buildAttendanceRows(roster, counts, sundays.length)));
      }),
    );
  }
}

/** Newest first. Members without `updatedAt` sort last rather than disappearing. */
function sortByUpdatedAt(members: readonly MemberSummary[]): MemberSummary[] {
  return [...members].sort(
    (left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''),
  );
}

function toUpcomingEvents(
  events: readonly EventRsvpDto[],
  now: Date,
): UpcomingEvent[] {
  return events
    .filter(event => event.isActive && new Date(event.windowStart) > now)
    .sort((left, right) => left.windowStart.localeCompare(right.windowStart))
    .slice(0, UPCOMING_EVENT_ROWS)
    .map(event => ({
      publicId: event.publicId,
      title: event.title,
      daysUntil: daysUntil(event.windowStart, now),
    }));
}

/**
 * Merges the ACTIVE roster with the per-Sunday counts. A group appears when it
 * has members *or* check-ins; `groupPublicId === null` is 소속 그룹 없음, whose
 * roster the members endpoint cannot give, so 전체 falls back to 참석.
 */
function buildAttendanceRows(
  roster: readonly MemberSummary[],
  counts: readonly AttendanceGroupCountsResponse[],
  sundays: number,
): GroupAttendanceRow[] {
  const rows = new Map<string, GroupAttendanceRow>();
  const keyOf = (groupPublicId: string | null) => groupPublicId ?? '';

  for (const member of roster) {
    const key = keyOf(member.groupPublicId ?? null);
    const row = rows.get(key) ?? {
      groupPublicId: member.groupPublicId ?? null,
      groupName: member.groupName ?? '소속 그룹 없음',
      attended: 0,
      total: 0,
      ratio: 0,
    };
    row.total += sundays;
    rows.set(key, row);
  }

  for (const response of counts) {
    for (const group of response.groups) {
      const key = keyOf(group.groupPublicId);
      const row = rows.get(key) ?? {
        groupPublicId: group.groupPublicId,
        groupName: group.groupName ?? '소속 그룹 없음',
        attended: 0,
        total: 0,
        ratio: 0,
      };
      row.attended += group.attendanceCount;
      rows.set(key, row);
    }
  }

  return [...rows.values()]
    .map(row => {
      const total = row.total > 0 ? row.total : row.attended;
      return { ...row, total, ratio: total > 0 ? Math.round((row.attended / total) * 100) : 0 };
    })
    .sort((left, right) => left.groupName.localeCompare(right.groupName, 'ko'));
}
