/** Supported UI languages. Korean is the default. */
export type AppLang = 'ko' | 'en';

/** localStorage key holding the user's chosen language (mirrors the `app-theme` pattern). */
export const LANG_STORAGE_KEY = 'app-lang';

/** Default language when nothing is persisted. */
export const DEFAULT_LANG: AppLang = 'ko';
