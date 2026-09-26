import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { featureGuard } from './feature.guard';

describe('featureGuard', () => {
  function run(roles: string[], feature: Parameters<typeof featureGuard>[0]) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(AuthService).roles.set(roles);
    return TestBed.runInInjectionContext(() =>
      featureGuard(feature)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  it('lets a granted role through', () => {
    expect(run(['admin'], 'members')).toBeTrue();
  });

  it('sends a direct URL without the role to /forbidden', () => {
    const result = run(['member'], 'members');
    expect(result instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/forbidden');
  });

  it('matches roles case-insensitively', () => {
    expect(run(['GROUP_LEADER'], 'churchGroups')).toBeTrue();
  });
});
