import {
  ApplicationConfig,
  APP_INITIALIZER,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withRouterConfig } from '@angular/router';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { APP_ROUTES } from './app.routes';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { AuthService } from './core/services/auth.service';
import { LANG_STORAGE_KEY, DEFAULT_LANG, type AppLang } from './core/i18n/language';

function initializeKeycloak(authService: AuthService) {
  return () => authService.init();
}

/** Persisted language, or Korean by default. Runs at bootstrap (browser). */
function getInitialLang(): AppLang {
  if (typeof localStorage === 'undefined') return DEFAULT_LANG;
  const stored = localStorage.getItem(LANG_STORAGE_KEY);
  return stored === 'en' || stored === 'ko' ? stored : DEFAULT_LANG;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      APP_ROUTES,
      withRouterConfig({ onSameUrlNavigation: 'reload' }),
    ),
    provideHttpClient(withFetch(), withInterceptors([jwtInterceptor])),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: { darkModeSelector: '.app-dark' },
      },
    }),
    provideTranslateService({
      lang: getInitialLang(),
      fallbackLang: DEFAULT_LANG,
      loader: provideTranslateHttpLoader({ prefix: '/i18n/', suffix: '.json' }),
    }),
    AuthService,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeKeycloak,
      deps: [AuthService],
      multi: true,
    },
  ],
};
