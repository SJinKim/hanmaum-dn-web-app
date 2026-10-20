import { computed, inject, Injectable } from '@angular/core';
import { FEATURE_ACCESS, FeatureId, SUPER_ROLES } from '../navigation/feature-access';
import { HomeBlockId, HomeBlockScope, HOME_BLOCKS } from '../navigation/home-blocks';
import { NavGroup, NavItem, NAV_GROUPS } from '../navigation/nav-config';
import { AuthService } from './auth.service';

/**
 * The one place a role decides whether something is rendered.
 *
 * `design-specs/DESIGN.md` §9: role-restricted blocks are *absent*, not
 * disabled — the role matrix (254:3) has no greyed-out state and no lock icon.
 *
 * Screen access is read/write per feature (`feature-access.ts`, #137): read
 * opens route and navigation, write shows the create, edit and delete actions.
 */
@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly auth = inject(AuthService);

  readonly isAdmin = computed(() => this.auth.isAdmin());

  /** True when the current user may see something gated on `role`. */
  can(role: string | undefined): boolean {
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
  canRead(feature: FeatureId): boolean {
    const allowed = FEATURE_ACCESS[feature].read;
    if (allowed === 'all') {
      return true;
    }
    return this.hasAnyRole([...SUPER_ROLES, ...allowed]);
  }

  /** Whether create, edit and delete actions of `feature` are rendered at all. */
  canWrite(feature: FeatureId): boolean {
    return this.hasAnyRole([...SUPER_ROLES, ...FEATURE_ACCESS[feature].write]);
  }

  /** Alias of `canRead`, kept for the route and nav callers. */
  canAccess(feature: FeatureId): boolean {
    return this.canRead(feature);
  }

  /**
   * Whether the user gets into the web app at all: some screen other than home
   * must be readable. Everyone else sees the 403 "화면 준비 중" variant.
   */
  readonly hasWebAccess = computed(
    () =>
      (Object.keys(FEATURE_ACCESS) as FeatureId[]).some(
        feature => feature !== 'home' && this.canRead(feature),
      ) ||
      // A role-gated Home block is web access too: 총무 has no screen but 홈 (#211).
      HOME_BLOCKS.some(block => !block.pending && !!block.roles?.length && this.canAny(block.roles)),
  );

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
    return !item.pending && this.hasWebAccess() && this.canRead(item.feature);
  }

  /**
   * The Home blocks this user may see, as ids — the Home template asks this and
   * renders nothing for a block that is missing from the set.
   */
  readonly homeBlocks = computed<ReadonlySet<HomeBlockId>>(
    () =>
      new Set(
        HOME_BLOCKS.filter(
          block => !block.pending && this.canAny(block.roles) && !this.isHiddenFor(block.hiddenForRoles)
            && (!this.guideOnly() || block.id === 'guide'),
        ).map(block => block.id),
      ),
  );

  /** A Guide-only account must not trigger legacy Home roster/check-in requests.
   * Additional feature grants keep their existing Home blocks. */
  private guideOnly(): boolean {
    return this.canRead('guide') && !(Object.keys(FEATURE_ACCESS) as FeatureId[])
      .some(feature => feature !== 'home' && feature !== 'guide' && this.canRead(feature));
  }

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

  /** A super role keeps every block, whatever else the user holds. */
  private isHiddenFor(roles: readonly string[] | undefined): boolean {
    if (!roles || roles.length === 0) {
      return false;
    }
    return this.hasAnyRole(roles) && !this.hasAnyRole(SUPER_ROLES);
  }

  /** Any-of, because a matrix row is often 관리자 *and* 목사님. */
  private canAny(roles: readonly string[] | undefined): boolean {
    if (!roles || roles.length === 0) {
      return true;
    }
    return roles.some(role => this.can(role));
  }
}
