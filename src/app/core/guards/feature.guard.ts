import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FeatureId } from '../navigation/feature-access';
import { RoleService } from '../services/role.service';

/**
 * Blocks a direct URL to a screen the role matrix does not grant, and sends the
 * user to the 403 page (Figma 745:41755) instead of an empty or broken screen.
 */
export function featureGuard(feature: FeatureId): CanActivateFn {
  return () => inject(RoleService).canAccess(feature) || inject(Router).createUrlTree(['/forbidden']);
}
