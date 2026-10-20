import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { RoleService } from '../../core/services/role.service';
import { GuideAreasComponent } from './guide-areas.component';
import { GuideArea } from './guide-area.model';

const area: GuideArea = { areaPublicId: 'a', roomPublicId: 'room', roomName: 'Sanctuary', label: 'A', displayOrder: 0, active: true, version: 3 };

describe('Guide area management interactions', () => {
  let http: HttpTestingController;
  let writable: boolean;
  beforeEach(() => {
    writable = true;
    TestBed.configureTestingModule({ imports: [GuideAreasComponent], providers: [provideHttpClient(), provideHttpClientTesting(),
      provideNoopAnimations(), provideTranslateService(), ConfirmationService,
      { provide: RoleService, useValue: { canWrite: () => writable } }] });
    TestBed.inject(TranslateService).use('ko');
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function create(rooms = true) {
    const fixture = TestBed.createComponent(GuideAreasComponent); fixture.detectChanges();
    http.expectOne('/api/v1/guide/counting-areas').flush({ success: true, data: [area] });
    http.expectOne('/api/v1/guide/counting-areas/rooms').flush({ success: true, data: rooms
      ? [{ publicId: 'room', name: 'Sanctuary', floorPublicId: 'floor', floorName: '1F' }] : [] });
    fixture.detectChanges(); return fixture;
  }
  it('hides write controls from viewers and guards imperative open', () => {
    writable = false; const f = create(); expect(f.nativeElement.querySelector('[data-testid="add-area"]')).toBeNull();
    f.componentInstance.open(area); expect(f.componentInstance.visible()).toBeFalse();
  });
  it('keeps edits and their original expected version after 409', () => {
    const f = create(); const c = f.componentInstance; c.open(area);
    c.form.controls.label.setValue('changed'); c.form.markAsDirty(); c.submit();
    const request = http.expectOne('/api/v1/guide/counting-areas/a'); expect(request.request.body.version).toBe(3);
    request.flush({}, { status: 409, statusText: 'conflict' });
    expect(c.form.controls.label.value).toBe('changed'); expect(c.visible()).toBeTrue(); expect(c.original()?.version).toBe(3);
    expect(c.hasUnsavedChanges()).toBeTrue(); c.submit(); http.expectNone('/api/v1/guide/counting-areas/a');
  });
  it('allows an unavailable original room only when deactivating its area', () => {
    const f = create(false); const c = f.componentInstance; c.open(area); expect(c.invalidRoom()).toBeTrue();
    c.form.controls.active.setValue(false); expect(c.invalidRoom()).toBeFalse(); c.submit();
    const request = http.expectOne('/api/v1/guide/counting-areas/a'); expect(request.request.body.roomPublicId).toBe('room');
    request.flush({ success: true, data: { ...area, active: false, version: 4 } }); expect(c.visible()).toBeFalse();
  });
  it('asks before discarding dirty form values and canceling keeps them', () => {
    const confirmation = TestBed.inject(ConfirmationService); const spy = spyOn(confirmation, 'confirm');
    const f = create(); const c = f.componentInstance; c.open(area); c.form.markAsDirty(); c.close();
    expect(spy).toHaveBeenCalled(); expect(c.visible()).toBeTrue(); expect(c.form.controls.label.value).toBe('A');
    spy.calls.mostRecent().args[0].accept?.(); expect(c.visible()).toBeFalse();
  });
  it('adds a fifth area in the same room without altering the four existing area records', () => {
    const f = create(); const c = f.componentInstance;
    const before = Array.from({ length: 4 }, (_, i) => ({ ...area, areaPublicId: 'a' + i, displayOrder: i }));
    c.state.areas.set(before); c.open();
    c.form.setValue({ roomPublicId: 'room', label: 'Fifth', order: '5', active: true }); c.form.markAsDirty(); c.submit();
    const request = http.expectOne('/api/v1/guide/counting-areas');
    expect(request.request.body).toEqual({ roomPublicId: 'room', label: 'Fifth', displayOrder: 4, active: true });
    c.close(); expect(c.visible()).toBeTrue();
    request.flush({ success: true, data: { ...area, areaPublicId: 'fifth', label: 'Fifth', displayOrder: 4 } });
    expect(c.state.areas().length).toBe(5); expect(c.state.areas().slice(0, 4)).toEqual(before);
    expect(c.hasUnsavedChanges()).toBeFalse();
  });
  it('does not submit invalid order or empty labels and Escape preserves dirty inputs until confirmed', () => {
    const f = create(); const c = f.componentInstance; c.open();
    c.form.setValue({ roomPublicId: 'room', label: ' ', order: '1.5', active: true }); c.form.markAsDirty(); c.submit();
    http.expectNone('/api/v1/guide/counting-areas');
    const spy = spyOn(TestBed.inject(ConfirmationService), 'confirm');
    c.escape(new Event('keydown')); expect(spy).toHaveBeenCalled(); expect(c.visible()).toBeTrue();
    expect(c.form.controls.order.value).toBe('1.5');
  });

});
