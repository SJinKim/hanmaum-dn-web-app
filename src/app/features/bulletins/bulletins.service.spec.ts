import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { BulletinsService } from './bulletins.service';

describe('BulletinsService — Sunday selection contract (#197)', () => {
  let service: BulletinsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(BulletinsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('passes the server cursor unchanged when requesting further Sundays', () => {
    service.defaults('2027-01-03').subscribe(data => expect(data.nextFrom).toBe('2027-03-28'));
    const request = http.expectOne(`${environment.apiBaseUrl}/v1/admin/bulletins/defaults?from=2027-01-03`);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, data: { serviceDate: '2026-10-11', sundays: [], nextFrom: '2027-03-28' } });
  });

  it('sends the displayed date and optional copy source when creating a draft', () => {
    service.create({ serviceDate: '2026-10-25', copyFrom: 'source-id' }).subscribe();
    const request = http.expectOne(`${environment.apiBaseUrl}/v1/admin/bulletins`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ serviceDate: '2026-10-25', copyFrom: 'source-id' });
    request.flush({ success: true, data: { publicId: 'new-edition' } });
  });
});
