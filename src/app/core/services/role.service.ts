import { computed, inject, Injectable } from '@angular/core';
import { FEATURE_ACCESS, FeatureId, SUPER_ROLES } from '../navigation/feature-access';
import { HomeBlockId, HomeBlockScope, HOME_BLOCKS } from '../navigation/home-blocks';
import { NavGroup, NavItem, NavRole, NAV_GROUPS } from '../navigation/nav-config';
import { AuthService } from './auth.service';

/**
 * The one place a role decides whether something is rendered.
 *
 * `design-specs/DESIGN.md` §9: role-restricted blocks are *absent*, not
 * disabled — the role matrix (254:3) has no greyed-out state and no lock icon.
 *
 * Only `ADMIN` exists in the Keycloak realm today; `leader` and `pastor` are
 * designed (and already carried by `nav-config.ts`) but not yet realm roles, so
 * an admin sees their entries until #32/#47 create them. When they do exist the
 * `roles()` check below starts answering on its own and this comment is the only
 * thing that needs deleting.
 */
@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly auth = inject(AuthService);

  readonly isAdmin = computed(() => this.auth.isAdmin());

  /** True when the current user may see something gated on `role`. */
  can(role: NavRole | undefined): boolean {
    if (!role) {
      return true;
    }
    if (this.auth.roles().some(r => r.toLowerCase() === role)) {
      return true;
    }
    return role === 'admin' ? false : this.auth.isAdmin();
  }

  /** True when the user holds at least one of `roles`, compared case-insensitively. */
  hasAnyRole(roles: readonly string[]): boolean {
    const wanted = roles.map(role => role.toLowerCase());
    return this.auth.roles().some(granted => wanted.includes(granted.toLowerCase()));
  }

  /**
   * The role matrix (`feature-access.ts`) answered for the current user. Guards,
   * sidebar and header all ask this — nothing checks a role name on its own.
   */
  canAccess(feature: FeatureId): boolean {
    const allowed = FEATURE_ACCESS[feature];
    if (allowed === 'all') {
      return true;
    }
    return this.hasAnyRole([...SUPER_ROLES, ...allowed]);
  }

  /**
   * `NAV_GROUPS` filtered to what this user may see and what is routed today.
   * A group whose every item is filtered out disappears with its label.
   */
  readonly navGroups = computed<readonly NavGroup[]>(() =>
    NAV_GROUPS.map(group => ({
      labelKey: group.labelKey,
      items: group.items.filter(item => this.isVisible(item)),
    })).filter(group => group.items.length > 0),
  );

  private isVisible(item: NavItem): boolean {
    return !item.pending && this.canAccess(item.feature);
  }

  /**
   * The Home blocks this user may see, as ids — the Home template asks this and
   * renders nothing for a block that is missing from the set.
   */
  readonly homeBlocks = computed<ReadonlySet<HomeBlockId>>(
    () =>
      new Set(
        HOME_BLOCKS.filter(block => !block.pending && this.canAny(block.roles)).map(
          block => block.id,
        ),
      ),
  );

  /** DESIGN.md §9: false means the block is absent, never disabled. */
  showsHomeBlock(id: HomeBlockId): boolean {
    return this.homeBlocks().has(id);
  }

  /**
   * Whether a block shows the whole church or only the caller's 순. Everything is
   * `all` today: the `own-group` roles are Keycloak *groups* (#47), not realm
   * roles, so nothing can resolve to a 순 yet.
   */
  homeBlockScope(id: HomeBlockId): HomeBlockScope {
    const block = HOME_BLOCKS.find(candidate => candidate.id === id);
    const ownGroupRoles = block?.ownGroupRoles ?? [];
    const matchesOwnGroupRole = ownGroupRoles.some(role =>
      this.auth.roles().some(granted => granted.toLowerCase() === role),
    );
    return matchesOwnGroupRole ? 'own-group' : 'all';
  }

  /** Any-of, because a matrix row is often 관리자 *and* 목사님. */
  private canAny(roles: readonly NavRole[] | undefined): boolean {
    if (!roles || roles.length === 0) {
      return true;
    }
    return roles.some(role => this.can(role));
  }
}
