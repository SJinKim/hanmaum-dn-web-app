import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { webAccessGuard } from './web-access.guard';

describe('webAccessGuard', () => {
  function run(roles: string[], url: string) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(AuthService).roles.set(roles);
    return TestBed.runInInjectionContext(() =>
      webAccessGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
  }

  it('lets a role with a screen besides 홈 in', () => {
    expect(run(['note_taker'], '/')).toBeTrue();
  });

  it('sends a member without any screen to /forbidden, even from 홈', () => {
    const result = run(['member'], '/');
    expect(result instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/forbidden');
  });

  it('lets /forbidden itself through, so the redirect cannot loop', () => {
    expect(run(['member'], '/forbidden')).toBeTrue();
  });
});
