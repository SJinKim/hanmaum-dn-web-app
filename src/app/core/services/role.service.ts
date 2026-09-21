import { computed, inject, Injectable } from '@angular/core';
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
    return !item.pending && this.can(item.role);
  }
}
