import { TestBed } from '@angular/core/testing';
import { Route } from '@angular/router';
import { APP_ROUTES } from '../../app.routes';
import { HOME_BLOCKS } from '../navigation/home-blocks';
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
      expect(routes).toContain('/archive');
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

  describe('homeBlocks', () => {
    it('gives an admin every block the matrix grants 관리자', () => {
      const blocks = withRoles(['ADMIN']).homeBlocks();
      expect(blocks.has('pendingApprovals')).toBeTrue();
      expect(blocks.has('awaitingRsvps')).toBeTrue();
      expect(blocks.has('groupAttendance')).toBeTrue();
      expect(blocks.has('overview')).toBeTrue();
      expect(blocks.has('recentActivity')).toBeTrue();
      expect(blocks.has('upcomingEvents')).toBeTrue();
    });

    it('hides 승인 대기 from a user who is neither 관리자 nor 목사님', () => {
      expect(withRoles(['USER']).showsHomeBlock('pendingApprovals')).toBeFalse();
    });

    it('still shows the three ungated blocks to a plain user', () => {
      const roles = withRoles(['USER']);
      expect(roles.showsHomeBlock('awaitingRsvps')).toBeTrue();
      expect(roles.showsHomeBlock('upcomingEvents')).toBeTrue();
      expect(roles.showsHomeBlock('groupAttendance')).toBeTrue();
    });

    it('drops blocks no endpoint backs yet, for every role', () => {
      ['ADMIN', 'PASTOR', 'USER'].forEach(role => {
        const roles = withRoles([role]);
        expect(roles.showsHomeBlock('longAbsent')).toBeFalse();
        expect(roles.showsHomeBlock('statistics')).toBeFalse();
      });
    });

    it('covers every registry entry — no block decides its own visibility', () => {
      const roles = withRoles(['ADMIN']);
      HOME_BLOCKS.forEach(block =>
        expect(roles.showsHomeBlock(block.id)).toBe(!block.pending),
      );
    });
  });

  describe('homeBlockScope', () => {
    it('scopes an admin to the whole church', () => {
      expect(withRoles(['ADMIN']).homeBlockScope('groupAttendance')).toBe('all');
    });

    it('scopes a 순장 to their own 순', () => {
      expect(withRoles(['LEADER']).homeBlockScope('overview')).toBe('own-group');
    });

    it('leaves an ungated block unscoped', () => {
      expect(withRoles(['LEADER']).homeBlockScope('upcomingEvents')).toBe('all');
    });
  });
});
