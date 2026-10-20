import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GuideAreaService } from './guide-area.service';
import { GuideArea, parseGuideOrder } from './guide-area.model';
import { RoleService } from '../../core/services/role.service';

export const AREA: GuideArea = { areaPublicId: 'area-a', roomPublicId: 'room', roomName: 'Sanctuary',
  label: 'A', displayOrder: 0, active: true, version: 3 };
const path = '/api/v1/guide/counting-areas';
const settings = { roomPublicId: 'room', label: 'B', displayOrder: 1, active: true };

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
    post.flush({ success: true, data: { ...AREA, ...settings } });
    service.save(settings, AREA).subscribe();
    const put = http.expectOne(`${path}/area-a`); expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ ...settings, version: 3 }); put.flush({ success: true, data: { ...AREA, ...settings, version: 4 } });
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
  it('validates whole-number order boundaries without coercion', () => {
    for (const value of ['', '0', '-1', '1.0', '1e3', ' 1', '2147483649', 'abc']) expect(parseGuideOrder(value)).toBeNull();
    expect(parseGuideOrder('1')).toBe(0); expect(parseGuideOrder('2147483648')).toBe(2147483647);
  });
});
