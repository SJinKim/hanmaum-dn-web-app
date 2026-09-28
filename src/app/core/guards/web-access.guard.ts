import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { RoleService } from '../services/role.service';

/**
 * Shell gate: only a user with at least one readable screen besides home gets
 * into the app (`feature-access.ts`). Everyone else is held on `/forbidden`,
 * which then shows the "화면 준비 중" variant (Figma 879:210 / 879:370).
 */
export const webAccessGuard: CanActivateChildFn = (_route, state) => {
  if (inject(RoleService).hasWebAccess() || state.url.startsWith('/forbidden')) {
    return true;
  }
  return inject(Router).createUrlTree(['/forbidden']);
};
