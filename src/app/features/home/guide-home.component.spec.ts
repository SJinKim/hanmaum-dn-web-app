import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ChartComponent } from '../../core/ui/chart/chart.component';
import { GuideHomeComponent } from './guide-home.component';
import { GuideHomeState } from './guide-home-state.service';
import { guideHomeFixture } from './guide-home.fixtures.spec';

describe('Guide Home report presentation and entry routing', () => {
  const initial = guideHomeFixture();
  const state = { snapshot: signal(initial), loading: signal(false), failed: signal(false), refreshing: signal(false),
    start: jasmine.createSpy('start'), reload: jasmine.createSpy('reload'), accept: jasmine.createSpy('accept'),
    fresh: jasmine.createSpy('fresh') };
  beforeEach(() => {
    state.snapshot.set(guideHomeFixture()); state.failed.set(false); state.loading.set(false); state.fresh.and.callFake(() => of(state.snapshot()));
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideTranslateService(), provideNoopAnimations()] });
    TestBed.overrideComponent(GuideHomeComponent, { set: { providers: [{ provide: GuideHomeState, useValue: state }] } });
    TestBed.inject(AuthService).roles.set(['GUIDE_VIEWER']);
  });
  function render() { const fixture = TestBed.createComponent(GuideHomeComponent); fixture.detectChanges(); return fixture; }
  it('uses the previous report date in the title while waiting for the next Sunday and never fabricates a room breakdown', () => {
    const fixture = render(), element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('[data-testid="guide-attendance-title"]')?.textContent).toContain('2026.10.18');
    expect(element.querySelector('[data-testid="guide-attendance-title"]')?.textContent).not.toContain('2026.10.25');
    expect(element.textContent).toContain('home.guide.summaryOnly');
    expect(element.querySelectorAll('[data-testid="guide-home-area"]').length).toBe(0);
    expect(element.querySelector('input')).toBeNull();
    expect(element.querySelector('[data-testid="guide-home-entry"]')).toBeNull();
    expect(element.querySelector('a[href*="/edit"]')).toBeNull();
  });
  it('marks the status block for the st regression (HDN-272) and shows the report date in it', () => {
    const status = render().nativeElement.querySelector('[data-testid="guide-home-status"]');
    expect(status?.textContent).toContain('2026.10.18');
  });
  it('labels a multi-week gap as the latest saved report rather than last week', () => {
    const data = guideHomeFixture(); data.currentSunday = '2026-11-01'; state.snapshot.set(data);
    expect(render().componentInstance.previousLabel()).toBe('home.guide.latestRecord');
  });
  it('renders five historical areas as supplied without querying or appending current configuration', () => {
    const data = guideHomeFixture(); data.attendance!.report.reportMode = 'DETAILED';
    const counts = { adultCount: 0, youthCount: null, compatibleAdultCount: 0, schoolCount: 0, totalCount: 0, complete: true };
    data.attendance!.rooms = Array.from({ length: 5 }, (_, i) => ({ areaPublicId: `a${i}`, roomPublicId: `r${i}`, roomName: 'Room', label: `Area ${i}`, displayOrder: i, counts }));
    data.attendance!.entries = data.attendance!.rooms.flatMap(room => [1, 2, 3].map(serviceNumber => ({ areaPublicId: room.areaPublicId, serviceNumber, counts })));
    state.snapshot.set(data); const fixture = render();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="guide-home-area"]').length).toBe(5);
    expect(fixture.nativeElement.textContent).toContain('Area 4');
  });
  it('keeps partial attendance and complete metric dates separate and sends identical API chart values', () => {
    const data = guideHomeFixture(); data.status = 'PARTIAL'; data.waitingForCurrentSunday = false;
    data.attendance!.report = { ...data.attendance!.report, serviceDate: '2026-10-25', service1Count: 0, service2Count: null, service3Count: null, totalCount: null, complete: false };
    state.snapshot.set(data); const fixture = render();
    expect(fixture.nativeElement.querySelector('[data-testid="guide-attendance-title"]').textContent).toContain('2026.10.25');
    expect(fixture.nativeElement.textContent).toContain('2026.10.18');
    const chart = fixture.debugElement.queryAll(By.directive(ChartComponent))[0].componentInstance as ChartComponent;
    expect(chart.series()[0].data).toEqual(data.timeline.map(point => point.totalCount));
    expect(chart.series()[0].data).toEqual([716, null]);
    expect(fixture.componentInstance.number(0)).toBe('0'); expect(fixture.componentInstance.number(null)).toBe('—');
  });
  it('shows stale data and the original timestamp after refresh failure', () => {
    state.failed.set(true); const fixture = render();
    expect(fixture.nativeElement.textContent).toContain('home.guide.stale');
    expect(fixture.nativeElement.querySelector('[data-testid="guide-attendance-title"]').textContent).toContain('2026.10.18');
    expect(state.snapshot().asOf).toBe(initial.asOf);
  });
  it('rechecks the Sunday and resumes its existing draft UUID rather than creating a duplicate', () => {
    TestBed.inject(AuthService).roles.set(['GUIDE_EDITOR']); const fixture = render();
    const fresh = guideHomeFixture(); fresh.currentSundayReport = { ...fresh.attendance!.report, publicId: 'draft-25', serviceDate: '2026-10-25', complete: false };
    state.fresh.and.returnValue(of(fresh)); const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.componentInstance.openCurrent(); expect(navigate).toHaveBeenCalledWith(['/guide/records', 'draft-25', 'edit'], undefined);
  });
  it('opens a new form with the server Sunday only after the fresh lookup finds no record', () => {
    TestBed.inject(AuthService).roles.set(['GUIDE_EDITOR']); const fixture = render();
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.componentInstance.openCurrent(); expect(navigate).toHaveBeenCalledWith(['/guide/attendance/new'], { queryParams: { date: '2026-10-25' } });
  });
  it('blocks viewer entry imperatively and keeps a failed lookup on Home', () => {
    const fixture = render(); const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    state.fresh.calls.reset(); fixture.componentInstance.openCurrent(); expect(state.fresh).not.toHaveBeenCalled();
    TestBed.inject(AuthService).roles.set(['GUIDE_EDITOR']); state.fresh.and.returnValue(throwError(() => new Error('offline')));
    fixture.componentInstance.openCurrent(); expect(fixture.componentInstance.navigationFailed()).toBeTrue(); expect(navigate).not.toHaveBeenCalled();
  });
});
