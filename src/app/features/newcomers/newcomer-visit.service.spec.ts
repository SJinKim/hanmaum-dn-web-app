import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NewcomerVisitService } from './newcomer-visit.service';

describe('NewcomerVisitService — 방문 기록 (#40)', () => {
  let service: NewcomerVisitService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NewcomerVisitService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const ok = (data: unknown) => ({ success: true, message: null, data });

  it('lists visits of a range', () => {
    let count = -1;
    service.getVisits({ from: '2026-09-05', to: '2026-10-04', page: 2, size: 20 }).subscribe(p => (count = p.content.length));

    const req = http.expectOne(r => r.url.endsWith('/v1/newcomers/visits'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toBe('2026-09-05');
    expect(req.request.params.get('to')).toBe('2026-10-04');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('20');
    req.flush(ok({ content: [{ publicId: 'v-1' }], totalElements: 41, totalPages: 3, number: 2, size: 20 }));
    expect(count).toBe(1);
  });

  it('leaves out from for 전체', () => {
    service.getVisits({ to: '2026-10-04', page: 0, size: 20 }).subscribe();

    const req = http.expectOne(r => r.url.endsWith('/v1/newcomers/visits'));
    expect(req.request.params.has('from')).toBeFalse();
    req.flush(ok({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }));
  });

  it('reads stats of a range', () => {
    service.getStats({ from: '2026-10-01', to: '2026-10-04' }).subscribe();

    const req = http.expectOne(r => r.url.endsWith('/v1/newcomers/visits/stats'));
    expect(req.request.params.get('from')).toBe('2026-10-01');
    req.flush(ok({ visits: 0 }));
  });

  it('creates, updates, deletes and links', () => {
    service.createVisit({ lastName: '홍', firstName: '길동' }).subscribe();
    const create = http.expectOne(r => r.url.endsWith('/v1/newcomers/visits') && r.method === 'POST');
    expect(create.request.body).toEqual({ lastName: '홍', firstName: '길동' });
    create.flush(ok({ publicId: 'v-1' }));

    service.updateVisit('v-1', { note: 'x' }).subscribe();
    http.expectOne(r => r.url.endsWith('/v1/newcomers/visits/v-1') && r.method === 'PATCH').flush(ok({}));

    service.deleteVisit('v-1').subscribe();
    http.expectOne(r => r.url.endsWith('/v1/newcomers/visits/v-1') && r.method === 'DELETE').flush(ok(null));

    service.linkProfile('v-1', null).subscribe();
    const link = http.expectOne(r => r.url.endsWith('/v1/newcomers/visits/v-1/profile'));
    expect(link.request.method).toBe('PUT');
    expect(link.request.body).toEqual({ newcomerPublicId: null });
    link.flush(ok({}));
  });
});
