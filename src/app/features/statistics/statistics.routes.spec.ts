import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import {
  longAbsenceListFixture,
  longAbsenceSummaryFixture,
  pageFixture,
} from '../../core/models/long-absent.fixtures.spec';
import { LongAbsenceHistoryItem } from '../../core/models/long-absent.model';
import { AuthService } from '../../core/services/auth.service';
import { LongAbsentApi } from '../../core/services/long-absent-api.service';
import { DashboardStats } from './statistics.model';
import { StatisticsService } from './statistics.service';
import { STATISTICS_ROUTES } from './statistics.routes';

@Component({ standalone: true, template: 'forbidden page' })
class ForbiddenStub {}

describe('STATISTICS_ROUTES (#277)', () => {
  let api: jasmine.SpyObj<LongAbsentApi>;
  let stats: jasmine.SpyObj<StatisticsService>;

  function setup(roles: string[]): void {
    api = jasmine.createSpyObj<LongAbsentApi>('LongAbsentApi', ['list', 'summary', 'setContactStatus', 'setMemo', 'markReturned', 'history', 'phase', 'changes']);
    api.list.and.returnValue(of(longAbsenceListFixture()));
    api.summary.and.returnValue(of(longAbsenceSummaryFixture()));
    api.history.and.returnValue(of(pageFixture<LongAbsenceHistoryItem>([])));
    stats = jasmine.createSpyObj<StatisticsService>('StatisticsService', ['getDashboard']);
    stats.getDashboard.and.returnValue(of({ genderDistribution: [], growthTrend: [], attendanceRate: [], serviceAttendance: [], divisionAttendance: [], trainingStages: [], ministryHeadcount: [] } as unknown as DashboardStats));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'analytics', children: STATISTICS_ROUTES },
          { path: 'forbidden', component: ForbiddenStub },
        ]),
        provideNoopAnimations(),
        provideTranslateService({ fallbackLang: 'ko' }),
        { provide: LongAbsentApi, useValue: api },
        { provide: StatisticsService, useValue: stats },
      ],
    });
    TestBed.inject(AuthService).roles.set(roles);
  }

  const current = (harness: RouterTestingHarness) =>
    Array.from(harness.routeNativeElement!.querySelectorAll('[aria-current="page"]')).map(a => a.getAttribute('data-testid'));

  it('opens the charts on /analytics with only the 통계 tab current, and no person list', async () => {
    setup(['pastor']);
    const harness = await RouterTestingHarness.create('/analytics');
    expect(harness.routeNativeElement!.querySelector('[data-chart="growth"]')).not.toBeNull();
    expect(current(harness)).toEqual(['tab-statistics']);
    expect(api.list).not.toHaveBeenCalled();
    expect(api.summary).toHaveBeenCalledTimes(1);
  });

  it('opens the follow-up on /analytics/long-absences with only its tab current, and no charts', async () => {
    setup(['ADMIN']);
    const harness = await RouterTestingHarness.create('/analytics/long-absences');
    expect(harness.routeNativeElement!.querySelector('app-long-absent-page')).toBeDefined();
    expect(harness.routeNativeElement!.querySelector('[data-chart]')).toBeNull();
    expect(current(harness)).toEqual(['tab-long-absent']);
    expect(stats.getDashboard).not.toHaveBeenCalled();
    expect(api.list).toHaveBeenCalledTimes(1);
  });

  it('switches tabs through the router and back again, reloading fresh each time', async () => {
    setup(['pastor']);
    const harness = await RouterTestingHarness.create('/analytics/long-absences');
    await harness.navigateByUrl('/analytics');
    expect(current(harness)).toEqual(['tab-statistics']);
    await harness.navigateByUrl('/analytics/long-absences');
    expect(current(harness)).toEqual(['tab-long-absent']);
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  for (const roles of [['USER'], ['group_leader'], ['note_taker'], ['general_operations_editor'], ['guide_viewer']]) {
    for (const url of ['/analytics', '/analytics/long-absences']) {
      it(`sends ${roles[0]} from ${url} to the 403 page before any request`, async () => {
        setup(roles);
        const harness = await RouterTestingHarness.create(url);
        expect(TestBed.inject(Router).url).toBe('/forbidden');
        expect(harness.routeNativeElement?.textContent).toContain('forbidden page');
        expect(api.list).not.toHaveBeenCalled();
        expect(api.summary).not.toHaveBeenCalled();
        expect(stats.getDashboard).not.toHaveBeenCalled();
      });
    }
  }
});
