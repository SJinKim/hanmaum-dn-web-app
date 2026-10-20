import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, CanActivateFn, CanDeactivateFn, RouterLink, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { provideTranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { RoleService } from '../../core/services/role.service';
import { GuideSummaryEditorComponent } from './guide-summary-editor.component';
import { GuideHistoryComponent } from './guide-history.component';
import { GuideHistoryService } from './guide-history.service';
import { GUIDE_ROUTES } from './guide.routes';
import { reportFixture, reportPage } from './guide-report.fixtures.spec';

describe('Guide report UI and route protection', () => {
  let writable: boolean;
  beforeEach(() => {
    writable = true;
    TestBed.configureTestingModule({ imports: [GuideSummaryEditorComponent, GuideHistoryComponent], providers: [
      provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations(), provideTranslateService(), provideRouter([]), ConfirmationService,
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ publicId: 'a' })) } },
      { provide: RoleService, useValue: { canRead: () => true, canWrite: () => writable } },
    ] });
  });
  function editor(): ComponentFixture<GuideSummaryEditorComponent> {
    const f = TestBed.createComponent(GuideSummaryEditorComponent), http = TestBed.inject(HttpTestingController);
    f.detectChanges(); http.expectOne('/api/v1/guide/worship-counts/a').flush({ success: true, data: reportFixture });
    http.expectOne(r => r.params.has('from')).flush({ success: true, data: reportPage([]) });
    f.detectChanges(); return f;
  }
  it('uses numeric keyboards and blocks letters, exponent notation and mixed paste without coercing values', () => {
    const f = editor(), input = f.nativeElement.querySelector('#service1Count') as HTMLInputElement;
    expect(input.type).toBe('text'); expect(input.inputMode).toBe('numeric');
    for (const data of ['x', 'e', '-1', '1.5']) {
      const event = new InputEvent('beforeinput', { data, cancelable: true, bubbles: true }); input.dispatchEvent(event);
      expect(event.defaultPrevented).toBeTrue();
    }
    const digit = new InputEvent('beforeinput', { data: '123', cancelable: true, bubbles: true }); input.dispatchEvent(digit);
    expect(digit.defaultPrevented).toBeFalse();
    const clipboard = new DataTransfer(); clipboard.setData('text', '12x');
    const paste = new ClipboardEvent('paste', { clipboardData: clipboard, cancelable: true, bubbles: true }); input.dispatchEvent(paste);
    expect(paste.defaultPrevented).toBeTrue(); TestBed.inject(HttpTestingController).verify();
  });
  it('protects a dirty editor and rejects direct viewer edit access', async () => {
    const f = editor(), c = f.componentInstance, confirmation = spyOn(TestBed.inject(ConfirmationService), 'confirm');
    c.state.form.markAsDirty(); const guard = GUIDE_ROUTES[2].canDeactivate![0] as CanDeactivateFn<GuideSummaryEditorComponent>;
    const result = TestBed.runInInjectionContext(() => guard(c, {} as never, {} as never, {} as never)) as Promise<boolean>;
    confirmation.calls.mostRecent().args[0].reject?.(); expect(await result).toBeFalse(); expect(c.state.form.dirty).toBeTrue();
    c.state.saving.set(true);
    expect(TestBed.runInInjectionContext(() => guard(c, {} as never, {} as never, {} as never))).toBeFalse(); expect(c.navigationBlocked()).toBeTrue();
    c.state.saving.set(false); TestBed.tick(); expect(c.navigationBlocked()).toBeFalse();
    writable = false; const editGuard = GUIDE_ROUTES[2].canActivate![0] as CanActivateFn;
    expect(TestBed.runInInjectionContext(() => editGuard({} as never, {} as never))).not.toBeTrue();
    TestBed.inject(HttpTestingController).verify();
  });
  it('links both modes to the shared editor and requires confirmation before deletion', () => {
    const state = TestBed.inject(GuideHistoryService); spyOn(state, 'load');
    state.page.set(reportPage([reportFixture, { ...reportFixture, publicId: 'detail', reportMode: 'DETAILED', service1Count: null, service2Count: 0 }]));
    state.years.set([2026]); state.loading.set(false); const remove = spyOn(state, 'remove').and.returnValue(of(undefined));
    const f = TestBed.createComponent(GuideHistoryComponent); f.detectChanges();
    // Two management links, two new-entry links, and both reports in table/cards.
    expect(f.debugElement.queryAll(By.directive(RouterLink)).length).toBe(8);
    const spy = spyOn(TestBed.inject(ConfirmationService), 'confirm'); f.componentInstance.confirmDelete(reportFixture);
    expect(remove).not.toHaveBeenCalled(); spy.calls.mostRecent().args[0].reject?.(); expect(remove).not.toHaveBeenCalled();
    f.componentInstance.confirmDelete(reportFixture); spy.calls.mostRecent().args[0].accept?.(); expect(remove).toHaveBeenCalledOnceWith(reportFixture);
    writable = false; // Role computations rerender on real role signals; imperative actions also check the current role.
    TestBed.inject(HttpTestingController).verify();
  });
  it('hides all edit/delete controls for viewers, including phone cards', () => {
    writable = false; const state = TestBed.inject(GuideHistoryService); spyOn(state, 'load'); state.page.set(reportPage([reportFixture]));
    const f = TestBed.createComponent(GuideHistoryComponent); f.detectChanges();
    expect(f.nativeElement.querySelector('a[href$="/edit"]')).toBeNull(); expect(f.nativeElement.querySelector('.pi-trash')).toBeNull();
    const spy = spyOn(TestBed.inject(ConfirmationService), 'confirm'); f.componentInstance.confirmDelete(reportFixture); expect(spy).not.toHaveBeenCalled();
    state.deleting.set(true); expect(f.componentInstance.canLeave()).toBeFalse(); expect(state.notice()).toBe('waitForDelete');
    TestBed.inject(HttpTestingController).verify();
  });
});
