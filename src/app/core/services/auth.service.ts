import { Injectable, signal } from '@angular/core';
import type Keycloak from 'keycloak-js';
import { environment } from '../../../environments/environment';
import { isPublicPath } from '../auth/public-routes';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Assigned during init(); keycloak-js is dynamically imported so the (~177kB)
  // library lands in its own chunk instead of the initial bundle. init() is
  // awaited in APP_INITIALIZER before any guard/interceptor runs, so _kc is
  // set by the time freshToken()/isAdmin()/logout() are reachable — except on
  // a public page (#42), where it stays unset until ensureLogin().
  private _kc?: Keycloak;

  readonly isAuthenticated = signal(false);
  readonly username        = signal<string>('');
  readonly roles           = signal<string[]>([]);

  /**
   * Call once at app startup. Returns true if authentication succeeded.
   * A public page (the QR newcomer form) starts without Keycloak, so it opens
   * in a private window without a login redirect.
   */
  async init(pathname: string = window.location.pathname): Promise<boolean> {
    if (isPublicPath(pathname)) return false;
    return this.startKeycloak();
  }

  /**
   * For a guard on an internal route reached from a public page: starts the
   * login that init() skipped. Resolves false while the browser redirects.
   */
  async ensureLogin(): Promise<boolean> {
    if (this.isAuthenticated()) return true;
    if (this._kc) {
      this.login();
      return false;
    }
    return this.startKeycloak();
  }

  private async startKeycloak(): Promise<boolean> {
    const { default: KeycloakCtor } = await import('keycloak-js');
    const kc = new KeycloakCtor({
      url:      environment.keycloak.url,
      realm:    environment.keycloak.realm,
      clientId: environment.keycloak.clientId,
    });

    const authenticated = await kc.init({
      onLoad:   'login-required',
      pkceMethod: 'S256',
      checkLoginIframe: false,
    });

    this.isAuthenticated.set(authenticated);
    this.attach(kc);

    // Keep the session alive while the tab is idle; API calls refresh on their own.
    setInterval(() => this.freshToken().catch(() => undefined), 20_000);

    return authenticated;
  }

  /** Wires an initialised Keycloak instance. Separate from init() so tests can pass a fake. */
  attach(kc: Keycloak): void {
    this._kc = kc;
    // Roles come from the token: after every refresh a revoked role disappears
    // from navigation and guards without a reload.
    kc.onAuthRefreshSuccess = () => this.syncFromToken();
    this.syncFromToken();
  }

  /**
   * Returns a token valid for at least 30 more seconds. If the session cannot
   * be refreshed any more, sends the user to login and rejects.
   */
  async freshToken(): Promise<string> {
    const kc = this._kc;
    if (!kc) throw new Error('Not authenticated');
    try {
      await kc.updateToken(30);
    } catch {
      this.login();
      throw new Error('Session expired');
    }
    if (!kc.token) {
      this.login();
      throw new Error('Not authenticated');
    }
    return kc.token;
  }

  login(): void {
    void this._kc?.login();
  }

  isAdmin(): boolean {
    return this.roles().some(r => r.toLowerCase() === 'admin');
  }

  private syncFromToken(): void {
    const parsed = this._kc?.tokenParsed;
    this.username.set(parsed?.['preferred_username'] ?? '');
    this.roles.set((parsed?.['realm_access'] as { roles?: string[] } | undefined)?.roles ?? []);
  }

  logout(): void {
    void this._kc?.logout({ redirectUri: window.location.origin });
  }
}
