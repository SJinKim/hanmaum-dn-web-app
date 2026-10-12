import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MemberCountService } from './member-count.service';

describe('MemberCountService (#207)', () => {
  let service: MemberCountService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MemberCountService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks /members/count for one status and unwraps the number', () => {
    let result: number | undefined;
    service.count('PENDING').subscribe(count => (result = count));

    const req = http.expectOne(r => r.url.endsWith('/v1/members/count'));
    expect(req.request.params.get('status')).toBe('PENDING');
    req.flush({ success: true, message: null, data: { count: 7 } });

    expect(result).toBe(7);
  });

  it('sends no status when it counts every member', () => {
    service.count().subscribe();

    const req = http.expectOne(r => r.url.endsWith('/v1/members/count'));
    expect(req.request.params.has('status')).toBeFalse();
    req.flush({ success: true, message: null, data: { count: 32 } });
  });
});
