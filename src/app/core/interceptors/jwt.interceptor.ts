import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { isPublicApiUrl } from '../auth/public-routes';

/**
 * True if `url` points at the own API (`apiBaseUrl`): same origin and a path
 * below the base path. Keycloak, translation files and foreign hosts never
 * get the token.
 */
export function isApiUrl(url: string, apiBaseUrl: string, pageOrigin: string): boolean {
  const target = new URL(url, pageOrigin);
  const base   = new URL(apiBaseUrl, pageOrigin);
  if (target.origin !== base.origin) return false;
  const basePath = base.pathname.replace(/\/+$/, '');
  return target.pathname === basePath || target.pathname.startsWith(`${basePath}/`);
}

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const origin = window.location.origin;
  // Public endpoints (#42) go out bare: the QR form has no session to refresh,
  // and a 401 there must not bounce a visitor to the staff login.
  if (!isApiUrl(req.url, environment.apiBaseUrl, origin)
      || isPublicApiUrl(req.url, environment.apiBaseUrl, origin)) {
    return next(req);
  }

  const auth = inject(AuthService);
  return from(auth.freshToken()).pipe(
    switchMap(token => next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))),
    catchError((error: unknown) => {
      // 401: the API no longer accepts the session. 403 stays with the caller,
      // it means "not allowed", not "logged out".
      if (error instanceof HttpErrorResponse && error.status === 401) {
        auth.login();
      }
      return throwError(() => error);
    }),
  );
};
