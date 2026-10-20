import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GuideHistoryService } from './guide-history.service';
import { RoleService } from '../../core/services/role.service';
import { previousFixture, reportFixture, reportPage } from './guide-report.fixtures.spec';

const url = '/api/v1/guide/worship-counts';
describe('Guide history server state', () => {
  let state: GuideHistoryService, http: HttpTestingController, writable: boolean;
  beforeEach(() => {
    writable = true;
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: RoleService, useValue: { canWrite: () => writable } }] });
    state = TestBed.inject(GuideHistoryService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  function bounds() {
    http.expectOne(r => r.url === url && !r.params.has('from') && r.params.get('sort') === 'serviceDate,asc')
      .flush({ success: true, data: reportPage([{ ...reportFixture, serviceDate: '2021-04-04' }], 254, 0, 1) });
    http.expectOne(r => r.url === url && !r.params.has('from') && r.params.get('sort') === 'serviceDate,desc')
      .flush({ success: true, data: reportPage([reportFixture], 254, 0, 1) });
  }
  it('uses server pagination and exact prior calendar week, with canonical totals and notes unchanged', () => {
    state.load({ year: 2026 });
    const request = http.expectOne(r => r.params.get('from') === '2026-01-01');
    expect(request.request.params.get('to')).toBe('2026-12-31');
    expect(request.request.params.get('sort')).toBe('serviceDate,desc');
    expect(request.request.params.get('size')).toBe('6');
    request.flush({ success: true, data: reportPage([reportFixture], 42) }); bounds();
    http.expectOne(r => r.params.get('from') === '2026-10-11' && r.params.get('to') === '2026-10-11')
      .flush({ success: true, data: reportPage([previousFixture], 1, 0, 1) });
    expect(state.page().totalElements).toBe(42); expect(state.latest()?.totalCount).toBe(716);
    expect(state.latest()?.notes).toBe('note\nsecond line'); expect(state.previous()?.service1Count).toBe(171);
    expect(state.years()).toContain(2021); expect(state.loading()).toBeFalse();
  });
  it('cancels stale loads and does not turn errors into empty successful history', () => {
    state.load({ year: 2026 }); const old = http.expectOne(r => r.params.get('from') === '2026-01-01');
    state.load({ year: 2025, page: 0 }); expect(old.cancelled).toBeTrue();
    http.expectOne(r => r.params.get('from') === '2025-01-01').flush({}, { status: 500, statusText: 'failed' });
    expect(state.loadFailed()).toBeTrue(); expect(state.loading()).toBeFalse();
  });
  it('keeps the latest overview fixed while paging and does not assume the adjacent row is last week', () => {
    state.load({ year: 2026, page: 1 });
    http.expectOne(r => r.params.get('from') === '2026-01-01' && r.params.get('page') === '1')
      .flush({ success: true, data: reportPage([{ ...reportFixture, serviceDate: '2026-09-06' }], 42, 1) });
    http.expectOne(r => r.params.get('from') === '2026-01-01' && r.params.get('page') === '0')
      .flush({ success: true, data: reportPage([reportFixture], 42, 0, 1) }); bounds();
    http.expectOne(r => r.params.get('from') === '2026-10-11').flush({ success: true, data: reportPage([]) });
    expect(state.latest()?.serviceDate).toBe('2026-10-18'); expect(state.previous()).toBeNull();
    expect(state.page().number).toBe(1);
  });
  it('refreshes a version conflict without silently retrying deletion', () => {
    state.remove(reportFixture).subscribe({ error: () => undefined });
    const request = http.expectOne(url + '/a?version=3'); expect(request.request.method).toBe('DELETE');
    request.flush({}, { status: 409, statusText: 'conflict' });
    expect(state.notice()).toBe('deleteConflict');
    http.expectOne(r => r.url === url && r.params.has('from')).flush({}, { status: 500, statusText: 'failed' });
    expect(state.deleting()).toBeFalse();
    writable = false; state.remove(reportFixture).subscribe({ error: () => undefined }); http.expectNone(url + '/a?version=3');
  });
});
