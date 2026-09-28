import { TestBed } from '@angular/core/testing';
import type Keycloak from 'keycloak-js';
import { AuthService } from './auth.service';

type FakeKeycloak = Pick<Keycloak, 'token' | 'tokenParsed' | 'updateToken' | 'login'> & {
  onAuthRefreshSuccess?: () => void;
};

function withKeycloak(kc: FakeKeycloak): AuthService {
  const auth = TestBed.inject(AuthService);
  auth.attach(kc as unknown as Keycloak);
  return auth;
}

function fakeKeycloak(roles: string[]): FakeKeycloak {
  return {
    token: 'token-1',
    tokenParsed: { preferred_username: 'kim', realm_access: { roles } },
    updateToken: jasmine.createSpy('updateToken').and.resolveTo(false),
    login: jasmine.createSpy('login').and.resolveTo(),
  };
}

describe('AuthService', () => {
  it('reads name and roles from the token', () => {
    const auth = withKeycloak(fakeKeycloak(['admin']));
    expect(auth.username()).toBe('kim');
    expect(auth.roles()).toEqual(['admin']);
  });

  it('refreshes a token about to expire before handing it out', async () => {
    const kc = fakeKeycloak(['admin']);
    const auth = withKeycloak(kc);
    expect(await auth.freshToken()).toBe('token-1');
    expect(kc.updateToken).toHaveBeenCalledWith(30);
  });

  it('sends the user to login when the session has expired', async () => {
    const kc = fakeKeycloak(['admin']);
    (kc.updateToken as jasmine.Spy).and.rejectWith(undefined);
    const auth = withKeycloak(kc);
    await expectAsync(auth.freshToken()).toBeRejected();
    expect(kc.login).toHaveBeenCalled();
  });

  it('drops a role the refreshed token no longer carries', () => {
    const kc = fakeKeycloak(['admin']);
    const auth = withKeycloak(kc);
    kc.tokenParsed = { preferred_username: 'kim', realm_access: { roles: ['member'] } };
    kc.onAuthRefreshSuccess?.();
    expect(auth.roles()).toEqual(['member']);
  });
});
