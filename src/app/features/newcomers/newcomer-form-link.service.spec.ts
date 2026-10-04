import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NewcomerFormLinkService } from './newcomer-form-link.service';
import { formLinkStatus, formLinkUrl } from '../../core/models/newcomer-form-link.model';

describe('NewcomerFormLinkService — QR 등록 링크 (#44)', () => {
  let service: NewcomerFormLinkService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(NewcomerFormLinkService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const ok = (data: unknown) => ({ success: true, message: null, data });
  const link = { publicId: 'l-1', expiresAt: '2026-10-04T20:00:00Z', revokedAt: null, active: true, useCount: 0 };

  it('lists the links', () => {
    let count = -1;
    service.getLinks().subscribe(links => (count = links.length));

    const req = http.expectOne(r => r.url.endsWith('/v1/newcomer-form-links'));
    expect(req.request.method).toBe('GET');
    req.flush(ok([link]));
    expect(count).toBe(1);
  });

  it('creates a link with its expiry and returns the token', () => {
    let token: string | null | undefined;
    service.createLink({ expiresAt: '2026-10-04T20:00:00.000Z' }).subscribe(l => (token = l.token));

    const req = http.expectOne(r => r.url.endsWith('/v1/newcomer-form-links'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ expiresAt: '2026-10-04T20:00:00.000Z' });
    req.flush(ok({ ...link, token: 'abc' }));
    expect(token).toBe('abc');
  });

  it('revokes a link by its publicId', () => {
    service.revokeLink('l-1').subscribe();

    const req = http.expectOne(r => r.url.endsWith('/v1/newcomer-form-links/l-1/revoke'));
    expect(req.request.method).toBe('POST');
    req.flush(ok({ ...link, active: false, revokedAt: '2026-10-04T12:00:00Z' }));
  });
});

describe('newcomer form link model (#44)', () => {
  it('tells 활성, 만료 and 취소 apart', () => {
    expect(formLinkStatus({ active: true, revokedAt: null })).toBe('active');
    expect(formLinkStatus({ active: false, revokedAt: null })).toBe('expired');
    expect(formLinkStatus({ active: false, revokedAt: '2026-10-04T12:00:00Z' })).toBe('revoked');
  });

  it('builds the public form URL from the token', () => {
    expect(formLinkUrl('https://dn.example', 'a/b')).toBe('https://dn.example/register/a%2Fb');
  });
});
