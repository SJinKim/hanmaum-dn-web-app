import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, CanActivateFn, CanDeactivateFn, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { RoleService } from '../../core/services/role.service';
import { GuideAttendanceComponent } from './guide-attendance.component';
import { GuideAttendanceDraft } from './guide-attendance.service';
import { GuideReportEditorComponent } from './guide-report-editor.component';
import { GUIDE_ROUTES } from './guide.routes';
import { areaFixture, detailFixture } from './guide-details.fixtures.spec';
import { reportFixture } from './guide-report.fixtures.spec';

const base = '/api/v1/guide/worship-counts';
describe('Guide detail entry interactions', () => {
  let http: HttpTestingController, writable: boolean;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  beforeEach(() => {
    writable = true; params = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({ imports: [GuideAttendanceComponent, GuideReportEditorComponent], providers: [
      provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(), provideTranslateService(), provideRouter([]), ConfirmationService,
      { provide: ActivatedRoute, useValue: { paramMap: params, snapshot: { paramMap: convertToParamMap({ publicId: 'a' }) } } },
      { provide: RoleService, useValue: { canWrite: () => writable } },
    ] }); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function entry(): ComponentFixture<GuideAttendanceComponent> {
    const f = TestBed.createComponent(GuideAttendanceComponent); f.detectChanges();
    http.expectOne('/api/v1/guide/counting-areas').flush({ success: true, data: Array.from({ length: 5 }, (_, i) => ({ ...areaFixture, areaPublicId: 'area-' + i, active: true, version: 0, displayOrder: i })) });
    http.expectOne('/api/v1/guide/counting-areas/rooms').flush({ success: true, data: [{ publicId: 'room' }] });
    f.detectChanges(); return f;
  }
  it('renders five dynamic areas and preserves all service values across tab switches', () => {
    const f = entry(), c = f.componentInstance;
    expect(f.nativeElement.querySelectorAll('[data-testid="guide-entry-area"]').length).toBe(5);
    const adult = f.nativeElement.querySelector('#compact-area-0-1-adultCount') as HTMLInputElement;
    adult.value = '42'; adult.dispatchEvent(new Event('input')); f.detectChanges();
    c.selectedService.set(3); f.detectChanges();
    expect(f.nativeElement.querySelectorAll('[id^="compact-"][id$="-youthCount"]').length).toBe(5);
    c.selectedService.set(1); f.detectChanges(); expect((f.nativeElement.querySelector('#compact-area-0-1-adultCount') as HTMLInputElement).value).toBe('42');
    expect(c.state.form.dirty).toBeTrue();
  });
  it('guards unsaved changes, pending saves and direct write routes', async () => {
    const c = entry().componentInstance; c.state.form.markAsDirty();
    const spy = spyOn(TestBed.inject(ConfirmationService), 'confirm');
    const guard = GUIDE_ROUTES[3].canDeactivate![0] as CanDeactivateFn<GuideAttendanceComponent>;
    const result = TestBed.runInInjectionContext(() => guard(c, {} as never, {} as never, {} as never)) as Promise<boolean>;
    spy.calls.mostRecent().args[0].reject?.(); expect(await result).toBeFalse(); expect(c.state.form.dirty).toBeTrue();
    c.state.saving.set(true); expect(TestBed.runInInjectionContext(() => guard(c, {} as never, {} as never, {} as never))).toBeFalse();
    expect(c.navigationBlocked()).toBeTrue(); writable = false;
    const writeGuard = GUIDE_ROUTES[3].canActivate![0] as CanActivateFn;
    expect(TestBed.runInInjectionContext(() => writeGuard({} as never, {} as never))).not.toBeTrue();
  });
  it('retains input for configuration navigation only after explicit confirmation', () => {
    const c = entry().componentInstance; c.state.form.markAsDirty();
    const spy = spyOn(TestBed.inject(ConfirmationService), 'confirm'); const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    c.manage(); spy.calls.mostRecent().args[0].reject?.(); expect(navigate).not.toHaveBeenCalled();
    c.manage(); spy.calls.mostRecent().args[0].accept?.(); expect(navigate).toHaveBeenCalled(); expect(TestBed.inject(GuideAttendanceDraft).value?.entries.length).toBe(15);
  });
  it('does not delete excluded area values until the user confirms', () => {
    const c = entry().componentInstance, remove = spyOn(c.state, 'discardRemoved'); const spy = spyOn(TestBed.inject(ConfirmationService), 'confirm');
    c.discardRemoved(); expect(remove).not.toHaveBeenCalled(); spy.calls.mostRecent().args[0].reject?.(); expect(remove).not.toHaveBeenCalled();
    c.discardRemoved(); spy.calls.mostRecent().args[0].accept?.(); expect(remove).toHaveBeenCalledTimes(1);
  });
  it('keeps detail read failures as failures instead of inventing a summary editor', () => {
    params.next(convertToParamMap({ publicId: 'a' }));
    const f = TestBed.createComponent(GuideReportEditorComponent); f.detectChanges();
    http.expectOne(base + '/a').flush({ success: true, data: detailFixture().report }); f.detectChanges();
    http.expectOne(base + '/a/details').flush({}, { status: 500, statusText: 'Error' }); f.detectChanges();
    expect(f.nativeElement.querySelector('app-guide-summary-editor')).toBeNull();
    expect(f.nativeElement.querySelector('app-empty-state')).not.toBeNull(); http.expectNone('/api/v1/guide/counting-areas');
  });
  it('routes explicit summary mode to the existing summary editor without loading details', () => {
    params.next(convertToParamMap({ publicId: 'a' }));
    const f = TestBed.createComponent(GuideReportEditorComponent); f.detectChanges();
    http.expectOne(base + '/a').flush({ success: true, data: reportFixture }); f.detectChanges();
    http.expectOne(base + '/a').flush({ success: true, data: reportFixture });
    http.expectOne(r => r.params.has('from')).flush({ success: true, data: { content: [] } }); f.detectChanges();
    expect(f.nativeElement.querySelector('app-guide-summary-editor')).not.toBeNull(); http.expectNone(base + '/a/details');
  });
});
