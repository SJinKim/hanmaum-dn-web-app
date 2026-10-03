import {
  EnvironmentProviders,
  effect,
  inject,
  provideEnvironmentInitializer,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { PrimeNG } from 'primeng/config';
import type { Translation } from 'primeng/api';

import { AppLang, toAppLang } from './language';

/**
 * PrimeNG's own strings (day and month names of p-datepicker, its 오늘/지우기
 * buttons). They live outside ngx-translate, so without this the calendar shows
 * English names inside the Korean UI (#129). English is listed in full because
 * switching back has to overwrite the Korean values again.
 */
export const PRIMENG_LOCALES: Record<AppLang, Translation> = {
  ko: {
    dayNames: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
    dayNamesShort: ['일', '월', '화', '수', '목', '금', '토'],
    dayNamesMin: ['일', '월', '화', '수', '목', '금', '토'],
    monthNames: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
    monthNamesShort: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
    today: '오늘',
    clear: '지우기',
    weekHeader: '주',
    firstDayOfWeek: 0,
  },
  en: {
    dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    dayNamesShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    dayNamesMin: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
    monthNames: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ],
    monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    today: 'Today',
    clear: 'Clear',
    weekHeader: 'Wk',
    firstDayOfWeek: 0,
  },
};

/** Keeps PrimeNG's strings on the language ngx-translate is using. */
export function providePrimeNgLocale(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    const translate = inject(TranslateService);
    const primeng = inject(PrimeNG);
    effect(() => primeng.setTranslation(PRIMENG_LOCALES[toAppLang(translate.currentLang())]));
  });
}
