import { TestBed } from '@angular/core/testing';
import { Route } from '@angular/router';
import { APP_ROUTES } from '../../app.routes';
import { FEATURE_ACCESS, FeatureId } from '../navigation/feature-access';
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
  // The shell is the route with children; public pages like `register/:token` sit beside it.
  const shell = APP_ROUTES.find(route => route.path === '' && route.children)!;
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

  describe('canAccess', () => {
    const ALL = Object.keys(FEATURE_ACCESS) as FeatureId[];

    it('opens every screen to an admin', () => {
      const roles = withRoles(['ADMIN']);
      ALL.forEach(feature => expect(roles.canAccess(feature)).withContext(feature).toBeTrue());
    });

    it('opens every screen to a pastor once the realm role exists', () => {
      const roles = withRoles(['pastor']);
      ALL.forEach(feature => expect(roles.canAccess(feature)).withContext(feature).toBeTrue());
    });

    it('gives a plain member only 홈', () => {
      const roles = withRoles(['member']);
      expect(ALL.filter(feature => roles.canAccess(feature))).toEqual(['home']);
    });

    it('gives a user without any role only 홈', () => {
      const roles = withRoles([]);
      expect(ALL.filter(feature => roles.canAccess(feature))).toEqual(['home']);
    });

    it('gives the 새가족 roles 홈 and 새가족, in any case', () => {
      ['NEWCOMER_VIEWER', 'newcomer_editor'].forEach(role => {
        const roles = withRoles([role]);
        expect(ALL.filter(feature => roles.canAccess(feature))).toEqual(['home', 'newcomers']);
      });
    });

    it('gives a 순장 their 순 but keeps admin-only screens closed', () => {
      ['group_leader', 'LEADER'].forEach(role => {
        const roles = withRoles([role]);
        expect(roles.canAccess('churchGroups')).toBeTrue();
        expect(roles.canAccess('members')).toBeFalse();
        expect(roles.canAccess('attendance')).toBeFalse();
      });
    });

    it('adds up several roles', () => {
      const roles = withRoles(['group_leader', 'NEWCOMER_VIEWER']);
      expect(roles.canAccess('churchGroups')).toBeTrue();
      expect(roles.canAccess('newcomers')).toBeTrue();
      expect(roles.canAccess('announcements')).toBeFalse();
    });
  });

  describe('note_taker', () => {
    it('reads 홈, 청년, 순 and 공지사항, in any case', () => {
      const ALL = Object.keys(FEATURE_ACCESS) as FeatureId[];
      ['note_taker', 'NOTE_TAKER'].forEach(role => {
        const roles = withRoles([role]);
        expect(ALL.filter(feature => roles.canRead(feature))).toEqual([
          'home',
          'members',
          'churchGroups',
          'announcements',
        ]);
      });
    });

    it('writes only 공지사항', () => {
      const roles = withRoles(['note_taker']);
      expect(roles.canWrite('announcements')).toBeTrue();
      expect(roles.canWrite('members')).toBeFalse();
      expect(roles.canWrite('churchGroups')).toBeFalse();
    });
  });

  describe('canWrite', () => {
    const ALL = Object.keys(FEATURE_ACCESS) as FeatureId[];

    it('lets admin and pastor write every screen', () => {
      ['ADMIN', 'pastor'].forEach(role => {
        const roles = withRoles([role]);
        ALL.forEach(feature => expect(roles.canWrite(feature)).withContext(feature).toBeTrue());
      });
    });

    it('lets only the 새가족 editor write 새가족', () => {
      expect(withRoles(['NEWCOMER_EDITOR']).canWrite('newcomers')).toBeTrue();
      expect(withRoles(['NEWCOMER_VIEWER']).canWrite('newcomers')).toBeFalse();
    });

    it('never lets a 순장 write, not even 순', () => {
      const roles = withRoles(['group_leader']);
      ALL.forEach(feature => expect(roles.canWrite(feature)).withContext(feature).toBeFalse());
    });

    it('keeps every write role a read role', () => {
      ALL.forEach(feature => {
        const { read, write } = FEATURE_ACCESS[feature];
        write.forEach(role =>
          expect(read === 'all' || read.includes(role)).withContext(`${feature}: ${role}`).toBeTrue(),
        );
      });
    });
  });

  describe('hasWebAccess', () => {
    it('admits admin, pastor, note_taker, 순장 and the 새가족 roles', () => {
      ['ADMIN', 'pastor', 'note_taker', 'group_leader', 'NEWCOMER_VIEWER'].forEach(role =>
        expect(withRoles([role]).hasWebAccess()).withContext(role).toBeTrue(),
      );
    });

    it('keeps out a member, an unknown ministry role and a user without roles', () => {
      [['member'], ['worship_viewer'], ['default-roles-hanmaum'], []].forEach(roles =>
        expect(withRoles(roles).hasWebAccess()).withContext(roles.join()).toBeFalse(),
      );
    });
  });

  describe('navGroups', () => {
    it('shows a member without web access no navigation at all', () => {
      expect(withRoles(['member']).navGroups()).toEqual([]);
    });

    it('shows a note_taker 홈, 청년, 순 and 공지사항', () => {
      const routes = withRoles(['note_taker'])
        .navGroups()
        .flatMap(group => group.items.map(item => item.route));
      expect(routes).toEqual(jasmine.arrayWithExactContents(['/', '/members', '/church-groups', '/announcements']));
    });

    it('shows a 순장 홈 and 순, and drops the empty groups', () => {
      const groups = withRoles(['group_leader']).navGroups();
      expect(groups.flatMap(group => group.items.map(item => item.route))).toEqual(['/', '/church-groups']);
      expect(groups.map(group => group.labelKey)).toEqual(['nav.groups.people']);
    });

    it('shows 통계 to admin and pastor only', () => {
      const routesOf = (roles: string[]) =>
        withRoles(roles)
          .navGroups()
          .flatMap(group => group.items.map(item => item.route));
      expect(routesOf(['ADMIN'])).toContain('/analytics');
      expect(routesOf(['pastor'])).toContain('/analytics');
      expect(routesOf(['note_taker'])).not.toContain('/analytics');
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
