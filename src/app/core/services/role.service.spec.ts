import { TestBed } from '@angular/core/testing';
import { Route } from '@angular/router';
import { APP_ROUTES } from '../../app.routes';
import { NAV_GROUPS } from '../navigation/nav-config';
import { AuthService } from './auth.service';
import { RoleService } from './role.service';

/** `RoleService` reads the roles at call time, so one TestBed serves several calls. */
function withRoles(roles: string[]): RoleService {
  TestBed.inject(AuthService).roles.set(roles);
  return TestBed.inject(RoleService);
}

/** The paths the shell route actually declares, `/`-prefixed like nav-config. */
function declaredRoutes(): string[] {
  const shell = APP_ROUTES[0];
  return (shell.children ?? []).map((child: Route) => `/${child.path ?? ''}`);
}

describe('RoleService', () => {
  describe('can', () => {
    it('lets every authenticated user see an ungated item', () => {
      expect(withRoles([]).can(undefined)).toBeTrue();
    });

    it('matches a realm role case-insensitively', () => {
      expect(withRoles(['ADMIN']).can('admin')).toBeTrue();
    });

    it('denies admin-only items to a user without the role', () => {
      expect(withRoles(['USER']).can('admin')).toBeFalse();
    });

    it('shows leader/pastor items to an admin until those realm roles exist', () => {
      const roles = withRoles(['ADMIN']);
      expect(roles.can('leader')).toBeTrue();
      expect(roles.can('pastor')).toBeTrue();
    });

    it('hides leader/pastor items from a plain user', () => {
      const roles = withRoles(['USER']);
      expect(roles.can('leader')).toBeFalse();
      expect(roles.can('pastor')).toBeFalse();
    });
  });

  describe('navGroups', () => {
    it('drops items whose screen is not routed yet', () => {
      const routes = withRoles(['ADMIN'])
        .navGroups()
        .flatMap(group => group.items.map(item => item.route));
      expect(routes).not.toContain('/newcomers');
      expect(routes).not.toContain('/archive');
      expect(routes).not.toContain('/analytics');
    });

    it('renders every remaining item as a route the app declares', () => {
      const declared = declaredRoutes();
      const routes = withRoles(['ADMIN'])
        .navGroups()
        .flatMap(group => group.items.map(item => item.route));
      expect(routes.length).toBeGreaterThan(0);
      routes.forEach(route => expect(declared).toContain(route));
    });

    it('keeps a group only while it has a visible item', () => {
      const labels = withRoles(['ADMIN']).navGroups().map(group => group.labelKey);
      expect(labels).toEqual(NAV_GROUPS.map(group => group.labelKey));
      expect(withRoles(['ADMIN']).navGroups().every(group => group.items.length > 0)).toBeTrue();
    });
  });
});
