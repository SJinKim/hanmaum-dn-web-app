import { Injectable, signal } from '@angular/core';
import type Keycloak from 'keycloak-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Assigned during init(); keycloak-js is dynamically imported so the (~177kB)
  // library lands in its own chunk instead of the initial bundle. init() is
  // awaited in APP_INITIALIZER before any guard/interceptor runs, so _kc is
  // always set by the time getToken()/isAdmin()/logout() are reachable.
  private _kc!: Keycloak;

  readonly isAuthenticated = signal(false);
  readonly username        = signal<string>('');
  readonly roles           = signal<string[]>([]);

  /** Call once at app startup. Returns true if authentication succeeded. */
  async init(): Promise<boolean> {
    const { default: KeycloakCtor } = await import('keycloak-js');
    this._kc = new KeycloakCtor({
      url:      environment.keycloak.url,
      realm:    environment.keycloak.realm,
      clientId: environment.keycloak.clientId,
    });

    const authenticated = await this._kc.init({
      onLoad:   'login-required',
      pkceMethod: 'S256',
      checkLoginIframe: false,
    });

    this.isAuthenticated.set(authenticated);

    if (authenticated) {
      this.username.set(this._kc.tokenParsed?.['preferred_username'] ?? '');
      this.roles.set(
        (this._kc.tokenParsed?.['realm_access'] as { roles: string[] })?.roles ?? []
      );
    }

    // Auto-refresh token 30 seconds before expiry
    setInterval(async () => {
      try {
        await this._kc.updateToken(30);
      } catch {
        this._kc.login();
      }
    }, 20_000);

    return authenticated;
  }

  getToken(): string | undefined {
    return this._kc.token;
  }

  isAdmin(): boolean {
    return this.roles().some(r => r.toLowerCase() === 'admin');
  }

  logout(): void {
    this._kc.logout({ redirectUri: window.location.origin });
  }
}
