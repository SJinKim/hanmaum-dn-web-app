import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Lets a logged-in user through. A session started on a public page (#42)
 * has no login yet; navigating inward starts it here.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() || auth.ensureLogin();
};
