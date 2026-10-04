import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PublicFormService } from './public-form.service';
import { PublicNewcomerSubmissionRequest } from '../../core/models/public-newcomer-form.model';

describe('PublicFormService — 새가족 등록 (#42)', () => {
  let service: PublicFormService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PublicFormService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const ok = (data: unknown) => ({ success: true, message: null, data });

  it('loads the form metadata for the token', () => {
    let version = '';
    service.getForm('tok-1').subscribe(m => (version = m.consentVersion));

    const req = http.expectOne(r => r.url.endsWith('/v1/newcomer-forms/tok-1'));
    expect(req.request.method).toBe('GET');
    req.flush(ok({ expiresAt: '2026-10-04T20:00:00Z', consentVersion: 'v1' }));
    expect(version).toBe('v1');
  });

  it('submits with the Idempotency-Key header', () => {
    const body: PublicNewcomerSubmissionRequest = {
      lastName: '홍', firstName: '길동', englishName: 'John Doe',
      visitMotives: ['지인의 소개로'], consentAccepted: true, honeypot: '',
    };
    let id = '';
    service.submit('tok-1', body, 'key-12345678').subscribe(r => (id = r.newcomerPublicId));

    const req = http.expectOne(r => r.url.endsWith('/v1/newcomer-forms/tok-1/submissions'));
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('key-12345678');
    expect(req.request.body).toEqual(body);
    req.flush(ok({ newcomerPublicId: 'n-1', submittedAt: '2026-10-04T10:00:00Z' }));
    expect(id).toBe('n-1');
  });
});
