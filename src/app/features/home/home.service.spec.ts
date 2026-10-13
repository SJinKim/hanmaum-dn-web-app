import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, of, throwError } from 'rxjs';
import { PageResponse } from '../../core/models/api-response.model';
import { MemberSummary } from '../../core/models/member.model';
import { MemberCountService } from '../../core/services/member-count.service';
import { AttendanceGroupCountsResponse, DefinitionDto } from '../attendance/attendance.model';
import { AttendanceService } from '../attendance/attendance.service';
import { EventRsvpService } from '../event-rsvps/event-rsvp.service';
import { MemberService } from '../members/member.service';
import { MinistryService } from '../ministry/ministry.service';
import { NewcomerVisitService } from '../newcomers/newcomer-visit.service';
import { groupSizeClass } from './home.model';
import { HomeService, QUICK_RECORD_PAGE_SIZE } from './home.service';

function page(totalElements: number): PageResponse<MemberSummary> {
  return { content: [], totalElements, totalPages: 1, number: 0, size: 1 };
}

/** What `/events/rsvps/active` answers an account without a member row. */
const NO_MEMBER_PROFILE = new HttpErrorResponse({ status: 404, statusText: 'Not Found' });

describe('HomeService — snapshot (#93)', () => {
  let service: HomeService;
  let members: jasmine.SpyObj<MemberService>;
  let memberCount: jasmine.SpyObj<MemberCountService>;
  let ministries: jasmine.SpyObj<MinistryService>;
  let rsvps: jasmine.SpyObj<EventRsvpService>;

  beforeEach(() => {
    members = jasmine.createSpyObj<MemberService>('MemberService', ['getMembers']);
    ministries = jasmine.createSpyObj<MinistryService>('MinistryService', ['getMinistries']);
    rsvps = jasmine.createSpyObj<EventRsvpService>('EventRsvpService', ['getActiveRsvps', 'getRsvps']);

    memberCount = jasmine.createSpyObj<MemberCountService>('MemberCountService', ['count']);
    members.getMembers.and.returnValue(of(page(0)));
    memberCount.count.and.callFake(status =>
      of(status === 'PENDING' ? 3 : status === 'ACTIVE' ? 28 : 32),
    );
    ministries.getMinistries.and.returnValue(of([]));
    rsvps.getActiveRsvps.and.returnValue(of([]));
    rsvps.getRsvps.and.returnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        { provide: MemberService, useValue: members },
        { provide: MemberCountService, useValue: memberCount },
        { provide: MinistryService, useValue: ministries },
        { provide: EventRsvpService, useValue: rsvps },
        { provide: NewcomerVisitService, useValue: jasmine.createSpyObj('NewcomerVisitService', ['getVisits']) },
      ],
    });
    service = TestBed.inject(HomeService);
  });

  it('keeps 승인 대기 when /events/rsvps/active answers 404', async () => {
    rsvps.getActiveRsvps.and.returnValue(throwError(() => NO_MEMBER_PROFILE));

    const snapshot = await firstValueFrom(service.loadSnapshot());

    expect(snapshot.pendingApprovals).toBe(3);
    expect(snapshot.overview.totalMembers).toBe(32);
    expect(snapshot.overview.activeMembers).toBe(28);
    expect(snapshot.awaitingRsvps).toBeNull();
  });

  it('marks only the failed count as unavailable, never as 0', async () => {
    ministries.getMinistries.and.returnValue(throwError(() => new Error('boom')));

    const snapshot = await firstValueFrom(service.loadSnapshot());

    expect(snapshot.overview.ministries).toBeNull();
    expect(snapshot.awaitingRsvps).toBe(0);
    expect(snapshot.pendingApprovals).toBe(3);
  });

  it('falls back to empty lists when their source fails', async () => {
    rsvps.getRsvps.and.returnValue(throwError(() => new Error('boom')));
    members.getMembers.and.returnValue(throwError(() => new Error('boom')));

    const snapshot = await firstValueFrom(service.loadSnapshot());

    expect(snapshot.upcomingEvents).toEqual([]);
    expect(snapshot.recentActivity).toEqual([]);
    expect(snapshot.pendingApprovals).toBe(3);
  });

  it('reads 승인 대기, 전체 and 활동 from /members/count, not from a member page (#207)', async () => {
    const snapshot = await firstValueFrom(service.loadSnapshot());

    expect(memberCount.count).toHaveBeenCalledWith('PENDING');
    expect(memberCount.count).toHaveBeenCalledWith();
    expect(memberCount.count).toHaveBeenCalledWith('ACTIVE');
    expect(members.getMembers).not.toHaveBeenCalledWith(jasmine.objectContaining({ size: 1 }));
    expect(snapshot.pendingApprovals).toBe(3);
  });

  it('marks a failed count as unavailable, the others stay (#207)', async () => {
    memberCount.count.and.callFake(status =>
      status === 'PENDING' ? throwError(() => new Error('boom')) : of(28),
    );

    const snapshot = await firstValueFrom(service.loadSnapshot());

    expect(snapshot.pendingApprovals).toBeNull();
    expect(snapshot.overview.activeMembers).toBe(28);
  });

  it('sends no /members request when 최근 활동 is not rendered — the note_taker path (#207)', async () => {
    const snapshot = await firstValueFrom(service.loadSnapshot({ recentActivity: false }));

    expect(members.getMembers).not.toHaveBeenCalled();
    expect(snapshot.recentActivity).toEqual([]);
    expect(snapshot.overview.totalMembers).toBe(32);
  });

  it('asks only the rendered blocks — the 총무 path sends nothing to /members (#211)', async () => {
    const snapshot = await firstValueFrom(
      service.loadSnapshot({
        pendingApprovals: false,
        overview: false,
        recentActivity: false,
        upcomingEvents: false,
      }),
    );

    expect(memberCount.count).not.toHaveBeenCalled();
    expect(members.getMembers).not.toHaveBeenCalled();
    expect(ministries.getMinistries).not.toHaveBeenCalled();
    expect(rsvps.getRsvps).not.toHaveBeenCalled();
    expect(rsvps.getActiveRsvps).toHaveBeenCalled();
    expect(snapshot.awaitingRsvps).toBe(0);
  });

  it('sends nothing to /events/rsvps/active when 응답 대기 is not rendered — the 새가족 path (#202)', async () => {
    const snapshot = await firstValueFrom(service.loadSnapshot({ awaitingRsvps: false }));

    expect(rsvps.getActiveRsvps).not.toHaveBeenCalled();
    expect(snapshot.awaitingRsvps).toBeNull();
  });
});

describe('HomeService — 빠른 기록 (#202)', () => {
  it('reads the visits up to today, newest page first', async () => {
    const visits = jasmine.createSpyObj<NewcomerVisitService>('NewcomerVisitService', ['getVisits']);
    visits.getVisits.and.returnValue(of({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }));
    TestBed.configureTestingModule({
      providers: [
        { provide: NewcomerVisitService, useValue: visits },
        { provide: MemberService, useValue: jasmine.createSpyObj('MemberService', ['getMembers']) },
        { provide: MemberCountService, useValue: jasmine.createSpyObj('MemberCountService', ['count']) },
        { provide: MinistryService, useValue: jasmine.createSpyObj('MinistryService', ['getMinistries']) },
        { provide: EventRsvpService, useValue: jasmine.createSpyObj('EventRsvpService', ['getActiveRsvps', 'getRsvps']) },
        { provide: AttendanceService, useValue: jasmine.createSpyObj('AttendanceService', ['getDefinitions', 'getGroupCounts']) },
      ],
    });

    await firstValueFrom(TestBed.inject(HomeService).loadQuickRecords(2, new Date(2026, 9, 13)));

    expect(visits.getVisits).toHaveBeenCalledOnceWith({ to: '2026-10-13', page: 2, size: QUICK_RECORD_PAGE_SIZE });
  });
});

describe('HomeService — 일요일 순별 참석 현황 (#211)', () => {
  let service: HomeService;
  let attendance: jasmine.SpyObj<AttendanceService>;
  let members: jasmine.SpyObj<MemberService>;

  const SUNDAY: DefinitionDto = {
    publicId: 'def-sun',
    title: '주일예배',
    dayOfWeek: 'SUNDAY',
    windowStart: '10:00:00',
    windowEnd: '13:00:00',
    isActive: true,
  };
  const FRIDAY: DefinitionDto = { ...SUNDAY, publicId: 'def-fri', title: '금요기도회', dayOfWeek: 'FRIDAY' };

  function counts(groups: { name: string | null; count: number }[]): AttendanceGroupCountsResponse {
    return {
      definitionPublicId: 'def-sun',
      definitionTitle: '주일예배',
      attendanceDate: '2026-10-11',
      totalCount: groups.reduce((sum, group) => sum + group.count, 0),
      groups: groups.map((group, index) => ({
        groupPublicId: group.name ? `g-${index}` : null,
        groupDivision: null,
        groupName: group.name,
        attendanceCount: group.count,
      })),
    };
  }

  beforeEach(() => {
    attendance = jasmine.createSpyObj<AttendanceService>('AttendanceService', ['getDefinitions', 'getGroupCounts']);
    members = jasmine.createSpyObj<MemberService>('MemberService', ['getMembers']);
    attendance.getDefinitions.and.returnValue(of([FRIDAY, SUNDAY]));
    attendance.getGroupCounts.and.returnValue(of(counts([{ name: '2순', count: 11 }, { name: '1순', count: 4 }])));

    TestBed.configureTestingModule({
      providers: [
        { provide: AttendanceService, useValue: attendance },
        { provide: MemberService, useValue: members },
        { provide: MemberCountService, useValue: jasmine.createSpyObj('MemberCountService', ['count']) },
        { provide: MinistryService, useValue: jasmine.createSpyObj('MinistryService', ['getMinistries']) },
        { provide: EventRsvpService, useValue: jasmine.createSpyObj('EventRsvpService', ['getActiveRsvps', 'getRsvps']) },
        { provide: NewcomerVisitService, useValue: jasmine.createSpyObj('NewcomerVisitService', ['getVisits']) },
      ],
    });
    service = TestBed.inject(HomeService);
  });

  it('reads the last Sunday of the Sunday service, without a roster', async () => {
    // Tuesday 2026-10-13 → Sunday 2026-10-11.
    const result = await firstValueFrom(service.loadSundayGroupCounts(new Date(2026, 9, 13)));

    expect(attendance.getGroupCounts).toHaveBeenCalledOnceWith({ definitionId: 'def-sun', date: '2026-10-11' });
    expect(members.getMembers).not.toHaveBeenCalled();
    expect(result.date).toBe('2026-10-11');
    expect(result.rows.map(row => [row.groupName, row.count, row.sizeClass])).toEqual([
      ['1순', 4, 'S'],
      ['2순', 11, 'XL'],
    ]);
  });

  it('names the members without a 순', async () => {
    attendance.getGroupCounts.and.returnValue(of(counts([{ name: null, count: 2 }])));

    const result = await firstValueFrom(service.loadSundayGroupCounts(new Date(2026, 9, 13)));

    expect(result.rows[0].groupName).toBe('소속 그룹 없음');
  });

  it('never falls back to another weekday when no Sunday service exists', async () => {
    attendance.getDefinitions.and.returnValue(of([FRIDAY]));

    const result = await firstValueFrom(service.loadSundayGroupCounts(new Date(2026, 9, 13)));

    expect(result).toEqual({ date: null, rows: [] });
    expect(attendance.getGroupCounts).not.toHaveBeenCalled();
  });

  it('answers an empty table when no service is defined', async () => {
    attendance.getDefinitions.and.returnValue(of([]));

    const result = await firstValueFrom(service.loadSundayGroupCounts());

    expect(result).toEqual({ date: null, rows: [] });
    expect(attendance.getGroupCounts).not.toHaveBeenCalled();
  });

  describe('이번 주 순별 체크인 (#206)', () => {
    [
      { today: new Date(2026, 9, 10), sunday: '2026-10-04', label: 'a Saturday reads the Sunday before' },
      { today: new Date(2026, 9, 11), sunday: '2026-10-11', label: 'a Sunday reads itself' },
      { today: new Date(2026, 9, 17), sunday: '2026-10-11', label: 'the week runs until the next Sunday' },
    ].forEach(({ today, sunday, label }) =>
      it(label, async () => {
        const result = await firstValueFrom(service.loadSundayCheckins(today));
        expect(attendance.getGroupCounts).toHaveBeenCalledOnceWith({ definitionId: 'def-sun', date: sunday });
        expect(result.date).toBe(sunday);
      }),
    );

    it('sorts the tiles by name, puts members without a 순 last and sums them', async () => {
      attendance.getGroupCounts.and.returnValue(
        of(counts([{ name: null, count: 2 }, { name: '2순', count: 11 }, { name: '1순', count: 4 }])),
      );

      const result = await firstValueFrom(service.loadSundayCheckins(new Date(2026, 9, 13)));

      expect(result.tiles.map(tile => [tile.groupName, tile.count])).toEqual([
        ['1순', 4],
        ['2순', 11],
        [null, 2],
      ]);
      expect(result.total).toBe(17);
      expect(members.getMembers).not.toHaveBeenCalled();
    });

    it('answers no tiles when no Sunday service exists', async () => {
      attendance.getDefinitions.and.returnValue(of([FRIDAY]));

      const result = await firstValueFrom(service.loadSundayCheckins(new Date(2026, 9, 13)));

      expect(result).toEqual({ date: null, tiles: [], total: 0 });
      expect(attendance.getGroupCounts).not.toHaveBeenCalled();
    });
  });
});

describe('groupSizeClass (#211)', () => {
  it('cuts at 5, 8 and 11', () => {
    expect([0, 4, 5, 7, 8, 10, 11, 30].map(groupSizeClass)).toEqual(['S', 'S', 'M', 'M', 'L', 'L', 'XL', 'XL']);
  });
});
