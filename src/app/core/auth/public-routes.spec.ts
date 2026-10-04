import { isPublicApiUrl, isPublicPath } from './public-routes';

describe('public routes', () => {
  const origin = 'https://dashboard.example';

  it('treats only the register form as a public page', () => {
    expect(isPublicPath('/register/abc')).toBeTrue();
    expect(isPublicPath('/register')).toBeFalse();
    expect(isPublicPath('/newcomers')).toBeFalse();
    expect(isPublicPath('/')).toBeFalse();
  });

  it('treats only the public newcomer-form endpoints as public', () => {
    expect(isPublicApiUrl('/api/v1/newcomer-forms/abc', '/api', origin)).toBeTrue();
    expect(isPublicApiUrl('/api/v1/newcomer-forms/abc/submissions', '/api', origin)).toBeTrue();
    expect(isPublicApiUrl('/api/v1/newcomer-form-links', '/api', origin)).toBeFalse();
    expect(isPublicApiUrl('/api/v1/newcomers', '/api', origin)).toBeFalse();
    expect(isPublicApiUrl('https://evil.example/api/v1/newcomer-forms/abc', '/api', origin)).toBeFalse();
  });
});
