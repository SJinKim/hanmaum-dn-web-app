import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { featureGuard } from './feature.guard';

describe('featureGuard', () => {
  function run(
    roles: string[],
    feature: Parameters<typeof featureGuard>[0],
    mode: Parameters<typeof featureGuard>[1] = 'read',
  ) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(AuthService).roles.set(roles);
    return TestBed.runInInjectionContext(() =>
      featureGuard(feature, mode)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
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

  it('lets a read-only role read', () => {
    expect(run(['note_taker'], 'members')).toBeTrue();
  });

  it('sends a read-only role on a write route to /forbidden', () => {
    const result = run(['note_taker'], 'members', 'write');
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/forbidden');
  });

  it('lets a write role through a write route', () => {
    expect(run(['note_taker'], 'announcements', 'write')).toBeTrue();
  });

  it('lets a pastor write every screen', () => {
    expect(run(['pastor'], 'members', 'write')).toBeTrue();
  });
});
