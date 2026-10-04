import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Newcomer } from '../../core/models/newcomer.model';
import { NewcomerService, mondayOf } from './newcomer.service';

function newcomer(publicId: string): Newcomer {
  return { publicId, lastName: '홍', firstName: '길동', version: 0 } as Newcomer;
}

describe('NewcomerService — 새가족 list state (#41)', () => {
  let service: NewcomerService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NewcomerService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function flushList(content: Newcomer[] = [newcomer('a')], totalElements = content.length): string {
    const req = http.expectOne(r => r.url.endsWith('/v1/newcomers'));
    const url = req.request.urlWithParams;
    req.flush({
      success: true,
      message: null,
      data: { content, totalElements, totalPages: 1, number: 0, size: 20 },
    });
    return url;
  }

  it('loads page 0 newest registration first', () => {
    service.loadNewcomers();
    const url = flushList([newcomer('a'), newcomer('b')], 2);

    expect(url).toContain('page=0');
    expect(url).toContain('sort=registrationDate');
    expect(url).toContain('direction=desc');
    expect(service.newcomers().length).toBe(2);
    expect(service.listLoading()).toBeFalse();
  });

  it('sends each filter under the server parameter name and returns to page 0', () => {
    service.page.set(3);
    service.setAttendance('REGULAR');
    flushList();
    service.setCaregiver('cg-1');
    flushList();
    service.setIdentity('EMPLOYEE');
    const url = flushList();

    expect(url).toContain('attendance=REGULAR');
    expect(url).toContain('caregiverPublicId=cg-1');
    expect(url).toContain('identityStatus=EMPLOYEE');
    expect(service.page()).toBe(0);
  });

  it('toggleSort starts a new column ascending and flips the current one', () => {
    service.toggleSort('name');
    expect(flushList()).toContain('direction=asc');
    service.toggleSort('name');
    expect(flushList()).toContain('direction=desc');
  });

  it('marks the list failed on an error', () => {
    service.loadNewcomers();
    http.expectOne(r => r.url.endsWith('/v1/newcomers')).flush(null, { status: 500, statusText: 'x' });

    expect(service.listFailed()).toBeTrue();
    expect(service.newcomers().length).toBe(0);
  });

  it('refreshCounts reads three totals with size=1', () => {
    service.refreshCounts(new Date(2026, 9, 4)); // Sunday
    const reqs = http.match(r => r.url.endsWith('/v1/newcomers'));
    expect(reqs.length).toBe(3);
    const urls = reqs.map(r => r.request.urlWithParams);
    expect(urls.some(u => u.includes('lifecycleStatus=IN_CARE'))).toBeTrue();
    expect(urls.some(u => u.includes('lifecycleStatus=GRADUATED'))).toBeTrue();
    expect(urls.some(u => u.includes('registeredFrom=2026-09-28'))).toBeTrue();
    reqs.forEach((r, i) =>
      r.flush({ success: true, message: null, data: { content: [], totalElements: i + 1, totalPages: 1, number: 0, size: 1 } }),
    );
    expect(service.inCareCount() + service.graduatedCount() + service.newThisWeekCount()).toBe(6);
  });

  it('mondayOf keeps a Monday and maps a Sunday back six days', () => {
    expect(mondayOf(new Date(2026, 8, 28))).toBe('2026-09-28');
    expect(mondayOf(new Date(2026, 9, 4))).toBe('2026-09-28');
  });
});
