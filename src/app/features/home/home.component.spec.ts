import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { MemberSummary } from '../../core/models/member.model';
import { AuthService } from '../../core/services/auth.service';
import { HomeComponent } from './home.component';
import { GroupAttendanceRow, HomeSnapshot } from './home.model';
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

const ROWS: GroupAttendanceRow[] = [
  { groupPublicId: 'g-1', groupName: '1순', attended: 8, total: 10, ratio: 80 },
  { groupPublicId: 'g-2', groupName: '2순', attended: 3, total: 10, ratio: 30 },
];

interface Harness {
  fixture: ComponentFixture<HomeComponent>;
  home: jasmine.SpyObj<HomeService>;
  router: jasmine.SpyObj<Router>;
  text: () => string;
}

function createHarness(roles: string[] = ['ADMIN']): Harness {
  const home = jasmine.createSpyObj<HomeService>('HomeService', [
    'loadSnapshot',
    'loadGroupAttendance',
  ]);
  home.loadSnapshot.and.returnValue(of(SNAPSHOT));
  home.loadGroupAttendance.and.returnValue(of(ROWS));
  const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
  router.navigate.and.resolveTo(true);

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
  });

  describe('data', () => {
    it('prints the snapshot counts the header cards and 현황 own', () => {
      const { text } = createHarness();
      const rendered = text();
      expect(rendered).toContain('3');
      expect(rendered).toContain('42');
      expect(rendered).toContain('D-5');
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
      ]);
      home.loadSnapshot.and.returnValue(of(SNAPSHOT));
      home.loadGroupAttendance.and.returnValue(of([]));
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
});
