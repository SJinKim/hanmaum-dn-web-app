import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FeatureId } from '../navigation/feature-access';
import { RoleService } from '../services/role.service';

/**
 * Blocks a direct URL to a screen the role matrix does not grant, and sends the
 * user to the 403 page (Figma 745:41755) instead of an empty or broken screen.
 * `write` is for create and edit routes: reading the screen is not enough.
 */
export function featureGuard(feature: FeatureId, mode: 'read' | 'write' = 'read'): CanActivateFn {
  return () => {
    const roles = inject(RoleService);
    const granted = mode === 'write' ? roles.canWrite(feature) : roles.canRead(feature);
    return granted || inject(Router).createUrlTree(['/forbidden']);
  };
}
