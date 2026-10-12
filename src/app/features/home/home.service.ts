import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { MemberSummary } from '../../core/models/member.model';
import { MemberCountService } from '../../core/services/member-count.service';
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
  SundayGroupCounts,
  UpcomingEvent,
  daysUntil,
  groupSizeClass,
  recentSundays,
} from './home.model';

/**
 * The snapshot blocks whose requests a role may be refused. `false` sends no
 * request for that block; an omitted key counts as `true`.
 */
export type SnapshotBlocks = Partial<
  Record<'pendingApprovals' | 'overview' | 'recentActivity' | 'upcomingEvents', boolean>
>;

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
  private readonly memberCount = inject(MemberCountService);
  private readonly ministries = inject(MinistryService);
  private readonly attendance = inject(AttendanceService);
  private readonly rsvps = inject(EventRsvpService);

  /**
   * Everything except 순별 참석 현황. Each source fails on its own (#93): an
   * account without a member profile gets 404 from `/events/rsvps/active`, and
   * that must cost 응답 대기 only — not 승인 대기, 현황 and the lists with it.
   *
   * The counts come from `/members/count`, which `note_taker` may read; the
   * member list may not (#207). 총무 may read neither, nor the 행사 list (#211).
   * So each block's requests go out only when the caller renders it —
   * `recentActivity: false` sends no `/members` request at all.
   */
  loadSnapshot(blocks: SnapshotBlocks = {}, now = new Date()): Observable<HomeSnapshot> {
    const shows = (block: keyof SnapshotBlocks) => blocks[block] ?? true;
    const when = <T>(block: keyof SnapshotBlocks, source: () => Observable<T>) =>
      shows(block) ? orNull(source()) : of(null);
    return forkJoin({
      pending: when('pendingApprovals', () => this.memberCount.count('PENDING')),
      total: when('overview', () => this.memberCount.count()),
      active: when('overview', () => this.memberCount.count('ACTIVE')),
      ministries: when('overview', () => this.ministries.getMinistries(true)),
      activeRsvps: orNull(this.rsvps.getActiveRsvps()),
      events: when('upcomingEvents', () => this.rsvps.getRsvps()),
      // No `sort` — the server ignores it (hanmaum-dn-server#196); `sortByUpdatedAt`
      // below does the ordering over the pool this fetches.
      recent: when('recentActivity', () => this.members.getMembers({ size: RECENT_ACTIVITY_POOL })),
    }).pipe(
      map(({ pending, total, active, ministries, activeRsvps, events, recent }) => ({
        pendingApprovals: pending,
        // `myStatus === null` is the caller's own 응답 대기; the church-wide
        // count needs hanmaum-dn-server#206.
        awaitingRsvps: activeRsvps?.filter(rsvp => rsvp.myStatus === null).length ?? null,
        overview: {
          totalMembers: total,
          activeMembers: active,
          ministries: ministries?.length ?? null,
        },
        recentActivity: sortByUpdatedAt(recent?.content ?? []).slice(0, RECENT_ACTIVITY_ROWS),
        upcomingEvents: toUpcomingEvents(events ?? [], now),
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
        // Only a Sunday service counts; another weekday's zeros would read as real.
        const sundayService = definitions.find(definition => definition.dayOfWeek === 'SUNDAY');
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

  /**
   * 일요일 순별 참석 현황 (#211): the last Sunday's check-ins per 순, nothing
   * else. No roster — 총무 may not read `/members` — so there is no 전체 and no
   * 비율, only 인원 and its size class.
   */
  loadSundayGroupCounts(now = new Date()): Observable<SundayGroupCounts> {
    const [date] = recentSundays(1, now);
    return this.attendance.getDefinitions(true).pipe(
      switchMap(definitions => {
        // Only a Sunday service counts; another weekday's zeros would read as real.
        const sundayService = definitions.find(definition => definition.dayOfWeek === 'SUNDAY');
        if (!sundayService) {
          return of<SundayGroupCounts>({ date: null, rows: [] });
        }
        return this.attendance
          .getGroupCounts({ definitionId: sundayService.publicId, date })
          .pipe(
            map(response => ({
              date,
              rows: response.groups
                .map(group => ({
                  groupPublicId: group.groupPublicId,
                  groupName: group.groupName ?? '소속 그룹 없음',
                  count: group.attendanceCount,
                  sizeClass: groupSizeClass(group.attendanceCount),
                }))
                .sort((left, right) => left.groupName.localeCompare(right.groupName, 'ko')),
            })),
          );
      }),
    );
  }
}

/** A failed request becomes `null`, so it cannot take its `forkJoin` siblings down. */
function orNull<T>(source: Observable<T>): Observable<T | null> {
  return source.pipe(catchError(() => of(null)));
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
