import { AppLang } from '../../core/i18n/language';

const LOCALE: Record<AppLang, string> = { ko: 'ko-KR', en: 'en-US' };

/** "2026. 9. 18." — the 접수 기간 is whole days. */
export function formatEventDate(iso: string, lang: AppLang): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { year: 'numeric', month: 'numeric', day: 'numeric' })
    .format(new Date(iso));
}

/** "9. 18. 오후 7:02" — the 체크인 time on the attendee list. */
export function formatCheckInTime(iso: string, lang: AppLang): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(iso));
}
