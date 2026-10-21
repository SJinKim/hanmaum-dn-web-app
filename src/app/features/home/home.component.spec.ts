import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { MemberSummary } from '../../core/models/member.model';
import { NewcomerVisit } from '../../core/models/newcomer-visit.model';
import { AuthService } from '../../core/services/auth.service';
import { GuideHomeComponent } from './guide-home.component';
import { HomeComponent } from './home.component';
import { GroupAttendanceRow, HomeSnapshot, SundayCheckins, SundayGroupCounts } from './home.model';
import { HomeService } from './home.service';

/**
 * No translations are loaded in the test harness, so `TranslatePipe` echoes the
 * key — which makes the rendered keys the cheapest assertion for "is this block
 * on screen?". DESIGN.md §9: a block a role may not see must be *absent*, so
 * every gating test asserts on presence, never on a disabled attribute.
 */
function member(overrides: Partial<MemberSummary> = {}): MemberSummary {
  return {
    publicId: 'm-1',
    lastName: '김',
    firstName: '철수',
    email: 'chulsoo@example.com',
    memberStatus: 'ACTIVE',
    baptism: null,
    groupName: '1순',
    role: 'ADMIN',
    updatedAt: '2026-09-18T10:00:00Z',
    ...overrides,
  };
}

const SNAPSHOT: HomeSnapshot = {
  pendingApprovals: 3,
  awaitingRsvps: 2,
  overview: { totalMembers: 42, activeMembers: 40, ministries: 7 },
  recentActivity: [member()],
  upcomingEvents: [{ publicId: 'e-1', title: '수련회', daysUntil: 5 }],
};

const CHECKINS: SundayCheckins = {
  date: '2026-10-11',
  tiles: [
    { groupPublicId: 'g-1', groupName: '1순', count: 4, quickRecords: 0 },
    { groupPublicId: null, groupName: null, count: 2, quickRecords: 0 },
  ],
  total: 6,
};

const SUNDAY_COUNTS: SundayGroupCounts = {
  date: '2026-10-11',
  rows: [
    { groupPublicId: 'g-1', groupName: '1순', count: 4, sizeClass: 'S', quickRecords: 0 },
    { groupPublicId: 'g-2', groupName: '2순', count: 12, sizeClass: 'XL', quickRecords: 0 },
  ],
};

const VISIT: NewcomerVisit = {
  publicId: 'v-1',
  visitDate: '2026-10-11',
  lastName: '홍',
  firstName: '길동',
  fullName: '홍길동',
  gender: 'M',
  birthYear: 2000,
  visitType: 'FIRST',
  source: null,
  note: null,
  newcomerPublicId: null,
  newcomerLifecycle: null,
  createdAt: '2026-10-11T03:00:00Z',
};

function visitPage(totalElements: number, number = 0) {
  return { content: [VISIT], totalElements, totalPages: Math.ceil(totalElements / 20), number, size: 20 };
}

const ROWS: GroupAttendanceRow[] = [
  { groupPublicId: 'g-1', groupName: '1순', attended: 8, total: 10, ratio: 80, quickRecords: 0 },
  { groupPublicId: 'g-2', groupName: '2순', attended: 3, total: 10, ratio: 30, quickRecords: 0 },
];

@Component({ selector: 'app-guide-home', standalone: true, template: 'Guide Home' })
class GuideHomeStub {}

interface Harness {
  fixture: ComponentFixture<HomeComponent>;
  home: jasmine.SpyObj<HomeService>;
  router: jasmine.SpyObj<Router>;
  text: () => string;
}

function createHarness(
  roles: string[] = ['ADMIN'],
  setup?: (home: jasmine.SpyObj<HomeService>) => void,
  username = '',
): Harness {
  const home = jasmine.createSpyObj<HomeService>('HomeService', [
    'loadSnapshot',
    'loadGroupAttendance',
    'loadSundayGroupCounts',
    'loadSundayCheckins',
    'loadQuickRecords',
  ]);
  home.loadSnapshot.and.returnValue(of(SNAPSHOT));
  home.loadGroupAttendance.and.returnValue(of(ROWS));
  home.loadSundayGroupCounts.and.returnValue(of(SUNDAY_COUNTS));
  home.loadSundayCheckins.and.returnValue(of(CHECKINS));
  home.loadQuickRecords.and.returnValue(of(visitPage(1)));
  setup?.(home);
  const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
  router.navigate.and.resolveTo(true);

  TestBed.overrideComponent(HomeComponent, { remove: { imports: [GuideHomeComponent] }, add: { imports: [GuideHomeStub] } });
  TestBed.configureTestingModule({
    imports: [HomeComponent],
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      provideTranslateService({ fallbackLang: 'en' }),
      { provide: HomeService, useValue: home },
      { provide: Router, useValue: router },
    ],
  });
  TestBed.inject(AuthService).roles.set(roles);
  TestBed.inject(AuthService).username.set(username);

  const fixture = TestBed.createComponent(HomeComponent);
  fixture.detectChanges();
  return {
    fixture,
    home,
    router,
    text: () => fixture.nativeElement.textContent as string,
  };
}

describe('HomeComponent', () => {
  it('requests no member, check-in, RSVP or newcomer data for a Guide-only account', () => {
    const { fixture, home } = createHarness(['GUIDE_EDITOR']);
    expect(fixture.nativeElement.querySelector('app-guide-home')).not.toBeNull();
    expect(home.loadSnapshot).toHaveBeenCalledWith({ pendingApprovals: false, awaitingRsvps: false, overview: false, recentActivity: false, upcomingEvents: false });
    expect(home.loadGroupAttendance).not.toHaveBeenCalled(); expect(home.loadSundayCheckins).not.toHaveBeenCalled();
    expect(home.loadSundayGroupCounts).not.toHaveBeenCalled(); expect(home.loadQuickRecords).not.toHaveBeenCalled();
  });

  describe('groups (#222)', () => {
    const headers = (fixture: ComponentFixture<HomeComponent>) =>
      Array.from(fixture.nativeElement.querySelectorAll('app-accordion-section [aria-expanded]') as NodeListOf<HTMLElement>);

    beforeEach(() => localStorage.removeItem('dn-home-sections:hong'));
    afterEach(() => localStorage.removeItem('dn-home-sections:hong'));

    it('shows an admin all five groups, expanded by default', () => {
      const { fixture, text } = createHarness(['ADMIN'], undefined, 'hong');
      const rendered = text();
      for (const id of ['guide', 'attention', 'sunday', 'newcomers', 'church']) {
        expect(rendered).toContain(`home.groups.${id}`);
      }
      expect(headers(fixture).map(h => h.getAttribute('aria-expanded'))).toEqual(['true', 'true', 'true', 'true', 'true']);
    });

    it('leaves a group out when the role sees none of its blocks', () => {
      const rendered = createHarness(['group_leader']).text();
      expect(rendered).not.toContain('home.groups.newcomers');
    });

    it('renders a single group plain, without a header', () => {
      const { fixture, text } = createHarness(['newcomer_viewer']);
      expect(fixture.nativeElement.querySelector('app-accordion-section')).toBeNull();
      expect(text()).not.toContain('home.groups.newcomers');
      expect(text()).toContain('home.quickRecords.heading');
    });

    it('collapses a group on click and remembers it for the same user', () => {
      const first = createHarness(['ADMIN'], undefined, 'hong');
      headers(first.fixture)[2].click();
      first.fixture.detectChanges();
      expect(headers(first.fixture)[2].getAttribute('aria-expanded')).toBe('false');
      expect(JSON.parse(localStorage.getItem('dn-home-sections:hong') ?? '[]')).toEqual(['sunday']);
      first.fixture.destroy();
      TestBed.resetTestingModule();

      const again = createHarness(['ADMIN'], undefined, 'hong');
      expect(headers(again.fixture).map(h => h.getAttribute('aria-expanded'))).toEqual(['true', 'true', 'false', 'true', 'true']);
    });

    it('keeps every group expanded when the stored state is unreadable', () => {
      localStorage.setItem('dn-home-sections:hong', '{not json');
      const { fixture } = createHarness(['ADMIN'], undefined, 'hong');
      expect(headers(fixture).every(h => h.getAttribute('aria-expanded') === 'true')).toBeTrue();
    });
  });

  describe('role variants', () => {
    it('gives an admin every block the Figma matrix grants 관리자', () => {
      const { text } = createHarness(['ADMIN']);
      const rendered = text();
      expect(rendered).toContain('home.attention.pendingApprovals');
      expect(rendered).toContain('home.attention.awaitingRsvps');
      expect(rendered).toContain('home.attendance.heading');
      expect(rendered).toContain('home.overview.heading');
      expect(rendered).toContain('home.recent.heading');
      expect(rendered).toContain('home.events.heading');
    });

    it('drops 승인 대기 for a user who is neither 관리자 nor 목사님', () => {
      const { text } = createHarness(['USER']);
      expect(text()).not.toContain('home.attention.pendingApprovals');
      expect(text()).toContain('home.attention.awaitingRsvps');
    });

    it('hides a block rather than disabling it', () => {
      const { fixture } = createHarness(['USER']);
      const disabled = fixture.nativeElement.querySelectorAll(
        '[disabled], [aria-disabled="true"]',
      );
      expect(disabled.length).toBe(0);
    });

    it('never renders a block no endpoint backs yet', () => {
      const { text } = createHarness(['ADMIN']);
      expect(text()).not.toContain('home.longAbsent');
      expect(text()).not.toContain('home.statistics');
    });

    it('drops 순별 참석 and 최근 활동 for a note_taker and loads neither (#207)', () => {
      const { text, home } = createHarness(['note_taker']);
      expect(text()).not.toContain('home.attendance.heading');
      expect(text()).not.toContain('home.recent.heading');
      expect(text()).toContain('home.overview.heading');
      expect(home.loadSnapshot).toHaveBeenCalledWith(jasmine.objectContaining({ recentActivity: false }));
      expect(home.loadGroupAttendance).not.toHaveBeenCalled();
    });

    it('asks an admin snapshot for every block (#207)', () => {
      const { home } = createHarness(['ADMIN']);
      expect(home.loadSnapshot).toHaveBeenCalledWith({
        pendingApprovals: true,
        awaitingRsvps: true,
        overview: true,
        recentActivity: true,
        upcomingEvents: true,
      });
    });

    it('gives 총무 only 응답 대기 and 일요일 순별 참석 현황 (#211)', () => {
      ['general_operations_viewer', 'GENERAL_OPERATIONS_EDITOR'].forEach(role => {
        TestBed.resetTestingModule();
        const { text, home } = createHarness([role]);
        const rendered = text();
        expect(rendered).toContain('home.attention.awaitingRsvps');
        expect(rendered).toContain('home.sundayCounts.heading');
        expect(rendered).not.toContain('home.attention.pendingApprovals');
        expect(rendered).not.toContain('home.attendance.heading');
        expect(rendered).not.toContain('home.overview.heading');
        expect(rendered).not.toContain('home.recent.heading');
        expect(rendered).not.toContain('home.events.heading');
        expect(home.loadSnapshot).toHaveBeenCalledWith({
          pendingApprovals: false,
          awaitingRsvps: true,
          overview: false,
          recentActivity: false,
          upcomingEvents: false,
        });
        expect(home.loadGroupAttendance).not.toHaveBeenCalled();
      });
    });

    it('shows 일요일 순별 참석 현황 to admin and pastor, not to a 순장 (#211)', () => {
      expect(createHarness(['ADMIN']).text()).toContain('home.sundayCounts.heading');
      TestBed.resetTestingModule();
      expect(createHarness(['pastor']).text()).toContain('home.sundayCounts.heading');
      TestBed.resetTestingModule();
      const leader = createHarness(['group_leader']);
      expect(leader.text()).not.toContain('home.sundayCounts.heading');
      expect(leader.home.loadSundayGroupCounts).not.toHaveBeenCalled();
    });

    it('shows 총무 the RSVP count with 확인하기, now that they may open 이벤트 (#213)', () => {
      ['general_operations_viewer', 'general_operations_editor'].forEach(role => {
        TestBed.resetTestingModule();
        const { text } = createHarness([role]);
        expect(text()).toContain('home.attention.awaitingRsvps');
        expect(text()).toContain('home.attention.confirm');
      });
    });

    it('keeps 확인하기 away from a role that may not open 이벤트 (#211)', () => {
      TestBed.resetTestingModule();
      expect(createHarness(['group_leader']).text()).not.toContain('home.attention.confirm');
    });

    it('shows a note_taker the 승인 대기 count without 승인하기 (#205)', () => {
      TestBed.resetTestingModule();
      const { text, home } = createHarness(['note_taker']);
      expect(text()).toContain('home.attention.pendingApprovals');
      expect(text()).not.toContain('home.attention.approve');
      expect(home.loadSnapshot).toHaveBeenCalledWith(jasmine.objectContaining({ pendingApprovals: true }));
    });

    it('keeps 승인하기 for admin and pastor (#205)', () => {
      ['ADMIN', 'pastor'].forEach(role => {
        TestBed.resetTestingModule();
        expect(createHarness([role]).text()).toContain('home.attention.approve');
      });
    });

    it('gives the 새가족 roles only 빠른 기록 and asks nothing else (#202)', () => {
      ['newcomer_viewer', 'NEWCOMER_EDITOR'].forEach(role => {
        TestBed.resetTestingModule();
        const { text, home } = createHarness([role]);
        const rendered = text();
        expect(rendered).toContain('home.quickRecords.heading');
        expect(rendered).not.toContain('home.attention.awaitingRsvps');
        expect(rendered).not.toContain('home.overview.heading');
        expect(rendered).not.toContain('home.events.heading');
        expect(rendered).not.toContain('home.empty');
        expect(home.loadQuickRecords).toHaveBeenCalledOnceWith(0);
        expect(home.loadSnapshot).toHaveBeenCalledWith(jasmine.objectContaining({ awaitingRsvps: false }));
        expect(home.loadGroupAttendance).not.toHaveBeenCalled();
      });
    });

    it('keeps 빠른 기록 away from a 순장 and never loads it (#202)', () => {
      TestBed.resetTestingModule();
      const leader = createHarness(['group_leader']);
      expect(leader.text()).not.toContain('home.quickRecords.heading');
      expect(leader.home.loadQuickRecords).not.toHaveBeenCalled();
    });

    it('lists the visits read-only and pages through them (#202)', () => {
      TestBed.resetTestingModule();
      const { fixture, home, router } = createHarness(['newcomer_viewer']);
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid="quick-records"]')?.textContent).toContain('홍길동');
      expect(el.querySelector('[data-testid="quick-records-pager"]')).toBeNull();

      home.loadQuickRecords.and.returnValue(of(visitPage(45, 1)));
      fixture.componentInstance.quickTotal.set(45);
      fixture.componentInstance.quickNext();
      fixture.detectChanges();
      expect(home.loadQuickRecords).toHaveBeenCalledWith(1);
      expect(el.querySelector('[data-testid="quick-records-pager"]')).not.toBeNull();

      fixture.componentInstance.goToQuickRecords();
      expect(router.navigate).toHaveBeenCalledWith(['/quick-records']);
    });

    it('shows a load error when the visits fail (#202)', () => {
      TestBed.resetTestingModule();
      const { fixture, home } = createHarness(['newcomer_viewer']);
      home.loadQuickRecords.and.returnValue(throwError(() => new Error('boom')));
      fixture.componentInstance.ngOnInit();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('home.quickRecords.loadFailed');
    });

    it('shows a load error, not an empty Sunday, when the counts fail (#211)', () => {
      TestBed.resetTestingModule();
      const home = createHarness(['general_operations_viewer']);
      home.home.loadSundayGroupCounts.and.returnValue(throwError(() => new Error('503')));
      home.fixture.componentInstance.ngOnInit();
      home.fixture.detectChanges();
      expect(home.text()).toContain('home.sundayCounts.loadFailed');
      expect(home.text()).not.toContain('home.sundayCounts.empty');
    });

    it('prints 순, 인원 and the size letter, never 전체 or 비율 (#211)', () => {
      const { fixture } = createHarness(['general_operations_viewer']);
      const table = fixture.nativeElement.querySelector('table') as HTMLTableElement;
      const headers = Array.from(table.querySelectorAll('thead th'), th => th.textContent?.trim());
      expect(headers).toEqual(['home.sundayCounts.group', 'home.sundayCounts.count']);
      const rows = Array.from(table.querySelectorAll('tbody tr'), tr => [
        tr.querySelector('th')?.textContent?.trim(),
        tr.querySelector('.tabular-nums')?.textContent?.trim(),
        tr.querySelector('app-badge')?.textContent?.trim(),
      ]);
      expect(rows).toEqual([
        ['1순', '4', 'S'],
        ['2순', '12', 'XL'],
      ]);
      expect(fixture.nativeElement.textContent).toContain('home.sundayCounts.legend.XL');
    });
  });

  describe('data', () => {
    it('prints the snapshot counts the header cards and 현황 own', () => {
      const { text } = createHarness();
      const rendered = text();
      expect(rendered).toContain('3');
      expect(rendered).toContain('42');
      expect(rendered).toContain('D-5');
    });

    it('prints — instead of 0 for a count that failed to load (#93)', () => {
      const { fixture, home } = createHarness();
      home.loadSnapshot.and.returnValue(of({ ...SNAPSHOT, awaitingRsvps: null }));
      fixture.componentInstance.ngOnInit();
      fixture.detectChanges();

      const counts = Array.from(
        fixture.nativeElement.querySelectorAll('.type-h2') as NodeListOf<HTMLElement>,
        el => el.textContent?.trim(),
      );
      expect(counts).toEqual(['3', '—']);
    });

    it('pins a 합계 row under the 순 rows', () => {
      const { fixture } = createHarness();
      const total = fixture.componentInstance.attendanceTotal();
      expect(total).not.toBeNull();
      expect(total?.attended).toBe(11);
      expect(total?.total).toBe(20);
      expect(total?.ratio).toBe(55);
    });

    it('has no 합계 row while there are no 순 rows', () => {
      const home = jasmine.createSpyObj<HomeService>('HomeService', [
        'loadSnapshot',
        'loadGroupAttendance',
        'loadSundayGroupCounts',
        'loadSundayCheckins',
        'loadQuickRecords',
      ]);
      home.loadSnapshot.and.returnValue(of(SNAPSHOT));
      home.loadGroupAttendance.and.returnValue(of([]));
      home.loadSundayGroupCounts.and.returnValue(of(SUNDAY_COUNTS));
      home.loadSundayCheckins.and.returnValue(of(CHECKINS));
      home.loadQuickRecords.and.returnValue(of(visitPage(0)));
      TestBed.overrideComponent(HomeComponent, { remove: { imports: [GuideHomeComponent] }, add: { imports: [GuideHomeStub] } });
  TestBed.configureTestingModule({
        imports: [HomeComponent],
        providers: [
          provideRouter([{ path: '**', children: [] }]),
          provideTranslateService({ fallbackLang: 'en' }),
          { provide: HomeService, useValue: home },
        ],
      });
      TestBed.inject(AuthService).roles.set(['ADMIN']);
      const fixture = TestBed.createComponent(HomeComponent);
      fixture.detectChanges();
      expect(fixture.componentInstance.attendanceTotal()).toBeNull();
      expect(fixture.nativeElement.textContent).toContain('home.attendance.empty');
    });

    it('reloads 순별 참석 현황 when the range changes', () => {
      const { fixture, home } = createHarness();
      home.loadGroupAttendance.calls.reset();
      fixture.componentInstance.onRangeChange('last-4-weeks');
      expect(fixture.componentInstance.range()).toBe('last-4-weeks');
      expect(home.loadGroupAttendance).toHaveBeenCalledOnceWith('last-4-weeks');
    });

    it('shortens an ISO timestamp without locale data', () => {
      const { fixture } = createHarness();
      expect(fixture.componentInstance.shortDate('2026-09-18T10:00:00Z')).toBe('2026.09.18');
      expect(fixture.componentInstance.shortDate(undefined)).toBe('');
    });

    it('maps 최근 활동 to the phone list-card record', () => {
      const { fixture } = createHarness();
      const [record] = fixture.componentInstance.recentRecords();
      expect(record.title).toBe('김철수');
      expect(record.badge?.variant).toBe('active');
      expect(record.meta).toBe('2026.09.18');
    });
  });

  describe('navigation', () => {
    it('deep-links 승인하기 to the pending members filter', () => {
      const { fixture, router } = createHarness();
      fixture.componentInstance.goToPendingMembers();
      expect(router.navigate).toHaveBeenCalledWith(['/members'], {
        queryParams: { status: 'PENDING' },
      });
    });

    it('opens a member from 최근 활동', () => {
      const { fixture, router } = createHarness();
      fixture.componentInstance.goToMember('m-1');
      expect(router.navigate).toHaveBeenCalledWith(['/members', 'm-1']);
    });
  });

  describe('이번 주 순별 체크인 (#206)', () => {
    afterEach(() => jasmine.clock().uninstall());

    function at(date: Date): void {
      jasmine.clock().install();
      jasmine.clock().mockDate(date);
    }

    it('draws one tile per 순 and the 합계', () => {
      at(new Date(2026, 9, 13, 10, 42));
      const { fixture } = createHarness(['group_leader']);
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelectorAll('[data-testid="checkin-tile"]').length).toBe(2);
      expect(el.querySelector('[data-testid="checkins-total"]')?.textContent).toContain('home.sundayCheckins.total');
      expect(fixture.componentInstance.checkinsUpdatedAt()).toBe('10:42');
    });

    it('loads once and shows no 실시간 badge on a weekday', () => {
      at(new Date(2026, 9, 13, 10, 0));
      const { fixture, home } = createHarness(['ADMIN']);
      expect(home.loadSundayCheckins).toHaveBeenCalledTimes(1);
      expect(fixture.nativeElement.querySelector('[data-testid="checkins-live"]')).toBeNull();
    });

    it('polls every 30 s on a Sunday and keeps polling after a failure', () => {
      at(new Date(2026, 9, 11, 10, 0));
      const { fixture, home } = createHarness(['ADMIN']);
      home.loadSundayCheckins.and.returnValue(throwError(() => new Error('down')));
      jasmine.clock().tick(0);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="checkins-live"]')).not.toBeNull();
      expect(home.loadSundayCheckins).toHaveBeenCalledTimes(1);

      jasmine.clock().tick(30_000);
      expect(home.loadSundayCheckins).toHaveBeenCalledTimes(2);
      expect(fixture.componentInstance.checkinsFailed()).toBeTrue();

      home.loadSundayCheckins.and.returnValue(of(CHECKINS));
      jasmine.clock().tick(30_000);
      expect(home.loadSundayCheckins).toHaveBeenCalledTimes(3);
      expect(fixture.componentInstance.checkinsFailed()).toBeFalse();
      fixture.destroy();
    });

    it('does not load the tiles for a role that may not see them', () => {
      const { fixture, home } = createHarness(['NEWCOMER_VIEWER']);
      expect(home.loadSundayCheckins).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('[data-testid="sunday-checkins"]')).toBeNull();
    });
  });

  describe('빠른 등록 hint (#223)', () => {
    const hints = (fixture: ComponentFixture<HomeComponent>) =>
      fixture.nativeElement.querySelectorAll('[data-testid="quick-records-hint"]') as NodeListOf<HTMLElement>;

    it('shows no hint while no row carries quick records', () => {
      const { fixture } = createHarness(['ADMIN']);
      expect(hints(fixture).length).toBe(0);
    });

    it('marks the 새가족 row in all three blocks', () => {
      const { fixture } = createHarness(['ADMIN'], home => {
        home.loadSundayGroupCounts.and.returnValue(
          of({
            ...SUNDAY_COUNTS,
            rows: [...SUNDAY_COUNTS.rows, { groupPublicId: 'g-new', groupName: '새가족', count: 6, sizeClass: 'M', quickRecords: 2 }],
          }),
        );
        home.loadSundayCheckins.and.returnValue(
          of({
            ...CHECKINS,
            tiles: [{ groupPublicId: 'g-new', groupName: '새가족', count: 4, quickRecords: 2 }, ...CHECKINS.tiles],
          }),
        );
        home.loadGroupAttendance.and.returnValue(
          of([...ROWS, { groupPublicId: 'g-new', groupName: '새가족', attended: 9, total: 11, ratio: 82, quickRecords: 3 }]),
        );
      });
      fixture.detectChanges();
      expect(hints(fixture).length).toBe(3);
      expect(Array.from(hints(fixture)).every(hint => hint.textContent?.includes('home.quickRecordsIncluded'))).toBeTrue();
    });
  });
});
