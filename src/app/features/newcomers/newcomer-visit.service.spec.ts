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
    service.getVisits({ from: '2026-09-05', to: '2026-10-04' }).subscribe(v => (count = v.length));

    const req = http.expectOne(r => r.url.endsWith('/v1/newcomers/visits'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toBe('2026-09-05');
    expect(req.request.params.get('to')).toBe('2026-10-04');
    req.flush(ok([{ publicId: 'v-1' }]));
    expect(count).toBe(1);
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
