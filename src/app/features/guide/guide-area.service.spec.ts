import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GuideAreaService } from './guide-area.service';
import { GuideArea } from './guide-area.model';
import { RoleService } from '../../core/services/role.service';

export const AREA: GuideArea = { areaPublicId: 'area-a', roomPublicId: 'room', roomName: 'Sanctuary',
  label: 'A', displayOrder: 0, active: true, version: 3 };
const path = '/api/v1/guide/counting-areas';
const settings = { roomPublicId: 'room', label: 'B', active: true };

describe('Guide counting area state and contract', () => {
  let service: GuideAreaService;
  let http: HttpTestingController;
  let writable: boolean;
  beforeEach(() => {
    writable = true;
    TestBed.configureTestingModule({ providers: [GuideAreaService, provideHttpClient(), provideHttpClientTesting(),
      { provide: RoleService, useValue: { canWrite: () => writable } }] });
    service = TestBed.inject(GuideAreaService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function refresh(data: GuideArea[]) {
    http.expectOne(path).flush({ success: true, data });
    http.expectOne(`${path}/rooms`).flush({ success: true, data: [] });
  }

  it('sorts configuration without collapsing areas sharing the same room', () => {
    service.load();
    http.expectOne(path).flush({ success: true, data: [{ ...AREA, areaPublicId: 'b', displayOrder: 1 }, AREA] });
    http.expectOne(`${path}/rooms`).flush({ success: true, data: [] });
    expect(service.areas().map(a => a.areaPublicId)).toEqual(['area-a', 'b']);
    expect(service.loading()).toBeFalse();
  });
  it('treats a lookup failure as a failure, never as an empty configuration', () => {
    service.areas.set([AREA]); service.load();
    http.expectOne(path).flush({ success: true, data: [] });
    http.expectOne(`${path}/rooms`).flush({}, { status: 500, statusText: 'failed' });
    expect(service.loadFailed()).toBeTrue(); expect(service.areas()).toEqual([AREA]);
  });
  it('sends only settings on create and the expected version on update', () => {
    service.save(settings, null).subscribe();
    const post = http.expectOne(path); expect(post.request.method).toBe('POST'); expect(post.request.body).toEqual(settings);
    post.flush({ success: true, data: { ...AREA, ...settings } }); refresh([{ ...AREA, ...settings }]);
    service.save(settings, AREA).subscribe();
    const put = http.expectOne(`${path}/area-a`); expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ ...settings, version: 3 }); put.flush({ success: true, data: { ...AREA, ...settings, version: 4 } }); refresh([{ ...AREA, ...settings, version: 4 }]);
    expect(service.areas().length).toBe(1); expect(service.areas()[0].version).toBe(4);
  });
  it('retains state and blocks automatic retries after conflicts', () => {
    service.areas.set([AREA]); service.save(settings, AREA).subscribe({ error: () => undefined });
    http.expectOne(`${path}/area-a`).flush({}, { status: 409, statusText: 'conflict' });
    expect(service.failure()).toBe('conflict'); expect(service.areas()).toEqual([AREA]);
    service.save(settings, AREA).subscribe({ error: () => undefined }); http.expectNone(`${path}/area-a`);
  });
  it('keeps field errors and denies writes when permissions are revoked', () => {
    service.save(settings, null).subscribe({ error: () => undefined });
    http.expectOne(path).flush({ data: { fieldErrors: { label: 'invalid' } } }, { status: 400, statusText: 'invalid' });
    expect(service.fieldErrors()['label']).toBe('invalid'); writable = false;
    service.save(settings, null).subscribe({ error: () => undefined }); http.expectNone(path);
  });
  it('keeps sorting local until Save and sends the complete UUID/version snapshot', () => {
    const second = { ...AREA, areaPublicId: 'b', label: 'B', displayOrder: 0, version: 7 };
    service.areas.set([AREA, second]); service.beginOrdering(); service.move(1, 0);
    expect(service.areas()).toEqual([AREA, second]);
    expect(service.displayedAreas().map(a => a.areaPublicId)).toEqual(['b', 'area-a']);
    expect(service.orderDirty()).toBeTrue(); http.expectNone(`${path}/order`);
    service.saveOrder().subscribe();
    const request = http.expectOne(`${path}/order`);
    expect(request.request.body).toEqual({ areas: [{ areaPublicId: 'b', version: 7 }, { areaPublicId: 'area-a', version: 3 }] });
    request.flush({ success: true, data: [{ ...second, displayOrder: 0, version: 8 }, { ...AREA, displayOrder: 1, version: 4 }] });
    expect(service.ordering()).toBeFalse(); expect(service.areas()[1].version).toBe(4);
  });
  it('cancel restores the saved order without writing and respects move boundaries', () => {
    service.areas.set([AREA, { ...AREA, areaPublicId: 'b' }]); service.beginOrdering();
    service.move(-1, 0); service.move(0, 2); expect(service.orderDirty()).toBeFalse();
    service.move(0, 1); service.cancelOrdering();
    expect(service.displayedAreas()[0]).toEqual(AREA); expect(service.orderDirty()).toBeFalse();
    http.expectNone(`${path}/order`);
  });
  it('preserves sorting and expected versions after 409 without reloading or retrying', () => {
    service.areas.set([AREA, { ...AREA, areaPublicId: 'b', version: 5 }]); service.beginOrdering(); service.move(0, 1);
    service.saveOrder().subscribe({ error: () => undefined });
    http.expectOne(`${path}/order`).flush({}, { status: 409, statusText: 'conflict' });
    expect(service.displayedAreas()[1].version).toBe(3); expect(service.orderDirty()).toBeTrue();
    service.saveOrder().subscribe({ error: () => undefined }); http.expectNone(`${path}/order`); http.expectNone(path);
  });
  it('removes only inactive areas with the original version and uses the canonical response', () => {
    service.remove(AREA).subscribe({ error: () => undefined }); http.expectNone(`${path}/area-a?version=3`);
    const inactive = { ...AREA, active: false }; service.areas.set([inactive]);
    service.remove(inactive).subscribe(); const request = http.expectOne(`${path}/area-a?version=3`);
    expect(request.request.method).toBe('DELETE'); request.flush({ success: true, data: [] });
    expect(service.areas()).toEqual([]); expect(inactive.label).toBe('A');
  });
  it('retains the known saved row but blocks more mutations when the canonical reload fails', () => {
    service.save(settings, null).subscribe();
    http.expectOne(path).flush({ success: true, data: { ...AREA, ...settings } });
    http.expectOne(`${path}/rooms`).flush({ success: true, data: [] });
    http.expectOne(path).flush({}, { status: 503, statusText: 'offline' });
    expect(service.loadFailed()).toBeTrue(); expect(service.areas()[0].label).toBe('B');
    service.save(settings, AREA).subscribe({ error: () => undefined }); http.expectNone(`${path}/area-a`);
  });
  it('rechecks write permissions during a sorting session', () => {
    service.areas.set([AREA, { ...AREA, areaPublicId: 'b' }]); service.beginOrdering(); service.move(0, 1); writable = false;
    service.saveOrder().subscribe({ error: () => undefined }); http.expectNone(`${path}/order`);
    service.cancelOrdering(); expect(service.ordering()).toBeFalse();
  });
});
