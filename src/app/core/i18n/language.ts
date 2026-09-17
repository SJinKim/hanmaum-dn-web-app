import { Signal, computed, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/** Supported UI languages. Korean is the default. */
export type AppLang = 'ko' | 'en';

/** localStorage key holding the user's chosen language (mirrors the `app-theme` pattern). */
export const LANG_STORAGE_KEY = 'app-lang';

/** Default language when nothing is persisted. */
export const DEFAULT_LANG: AppLang = 'ko';

/** Narrows an arbitrary language tag (e.g. from ngx-translate) to a supported one. */
export function toAppLang(value: string | null | undefined): AppLang {
  return value === 'en' || value === 'ko' ? value : DEFAULT_LANG;
}

/**
 * The active UI language as a signal, for components and services that render
 * language-dependent data themselves (catalog names, for instance) instead of going
 * through a translation key. Call from an injection context.
 */
export function injectAppLang(): Signal<AppLang> {
  const translate = inject(TranslateService);
  return computed(() => toAppLang(translate.currentLang()));
}
