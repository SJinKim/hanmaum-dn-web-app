import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { PrimeNG, providePrimeNG } from 'primeng/config';

import { PRIMENG_LOCALES, providePrimeNgLocale } from './primeng-locale';

describe('providePrimeNgLocale', () => {
  function setup(lang: string) {
    TestBed.configureTestingModule({
      providers: [providePrimeNG(), provideTranslateService({ lang, fallbackLang: 'ko' }), providePrimeNgLocale()],
    });
    TestBed.tick();
    return { primeng: TestBed.inject(PrimeNG), translate: TestBed.inject(TranslateService) };
  }

  it('puts the datepicker on Korean day and month names', () => {
    const { primeng } = setup('ko');
    expect(primeng.translation.dayNamesMin).toEqual(PRIMENG_LOCALES.ko.dayNamesMin!);
    expect(primeng.translation.monthNames![0]).toBe('1월');
  });

  it('follows a language switch', () => {
    const { primeng, translate } = setup('ko');
    translate.use('en');
    TestBed.tick();
    expect(primeng.translation.monthNames![0]).toBe('January');
    expect(primeng.translation.today).toBe('Today');
  });
});
