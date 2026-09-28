import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '../services/auth.service';
import { isApiUrl, jwtInterceptor } from './jwt.interceptor';

describe('isApiUrl', () => {
  const origin = 'https://dashboard.example';

  it('matches a relative base on the page origin only', () => {
    expect(isApiUrl('/api/members', '/api', origin)).toBeTrue();
    expect(isApiUrl('https://dashboard.example/api/members', '/api', origin)).toBeTrue();
    expect(isApiUrl('/i18n/ko.json', '/api', origin)).toBeFalse();
    expect(isApiUrl('https://evil.example/api/members', '/api', origin)).toBeFalse();
  });

  it('matches an absolute base on its own host only', () => {
    const base = 'https://api.example/api';
    expect(isApiUrl('https://api.example/api/members', base, origin)).toBeTrue();
    expect(isApiUrl('/api/members', base, origin)).toBeFalse();
    expect(isApiUrl('https://auth.example/realms/x/protocol/openid-connect/token', base, origin)).toBeFalse();
  });

  it('respects the path boundary', () => {
    expect(isApiUrl('/apix/members', '/api', origin)).toBeFalse();
    expect(isApiUrl('/api', '/api', origin)).toBeTrue();
  });
});

describe('jwtInterceptor', () => {
  let auth: jasmine.SpyObj<Pick<AuthService, 'freshToken' | 'login'>>;
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    auth = jasmine.createSpyObj('AuthService', ['freshToken', 'login']);
    auth.freshToken.and.resolveTo('fresh-token');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  /** freshToken() resolves on a microtask; the request reaches the backend after it. */
  const settle = () => new Promise(resolve => setTimeout(resolve));

  it('sends a refreshed token to the own API', async () => {
    http.get('/api/members').subscribe();
    await settle();
    const req = backend.expectOne('/api/members');
    expect(auth.freshToken).toHaveBeenCalled();
    expect(req.request.headers.get('Authorization')).toBe('Bearer fresh-token');
    req.flush({});
  });

  it('sends no token to a foreign host or a static asset', async () => {
    http.get('https://evil.example/api/members').subscribe();
    http.get('/i18n/ko.json').subscribe();
    await settle();
    expect(backend.expectOne('https://evil.example/api/members').request.headers.has('Authorization')).toBeFalse();
    expect(backend.expectOne('/i18n/ko.json').request.headers.has('Authorization')).toBeFalse();
    expect(auth.freshToken).not.toHaveBeenCalled();
  });

  it('fails the call instead of sending it without a token when the session has expired', async () => {
    auth.freshToken.and.rejectWith(new Error('session expired'));
    const error = jasmine.createSpy('error');
    http.get('/api/members').subscribe({ error });
    await settle();
    backend.expectNone('/api/members');
    expect(error).toHaveBeenCalled();
  });

  it('sends the user to login when the API rejects the token', async () => {
    const error = jasmine.createSpy('error');
    http.get('/api/members').subscribe({ error });
    await settle();
    backend.expectOne('/api/members').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(auth.login).toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });

  it('leaves a 403 to the caller', async () => {
    const error = jasmine.createSpy('error');
    http.get('/api/members').subscribe({ error });
    await settle();
    backend.expectOne('/api/members').flush(null, { status: 403, statusText: 'Forbidden' });
    expect(auth.login).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });
});
