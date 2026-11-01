import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { longAbsenceSummaryFixture } from '../../core/models/long-absent.fixtures.spec';
import { LongAbsentApi } from '../../core/services/long-absent-api.service';
import { LongAbsentHomeComponent } from './long-absent-home.component';

describe('LongAbsentHomeComponent (#277)', () => {
  let api: jasmine.SpyObj<LongAbsentApi>;

  beforeEach(() => {
    api = jasmine.createSpyObj<LongAbsentApi>('LongAbsentApi', ['list', 'summary', 'setContactStatus', 'setMemo', 'markReturned', 'history', 'phase', 'changes']);
    TestBed.configureTestingModule({
      imports: [LongAbsentHomeComponent],
      providers: [provideRouter([]), provideTranslateService({ fallbackLang: 'ko' })],
    });
    TestBed.overrideProvider(LongAbsentApi, { useValue: api });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('ko', { home: { attention: { longAbsentSixPlus: '6개월+ {{count}}명' } } });
    translate.use('ko');
  });

  function render() {
    const fixture = TestBed.createComponent(LongAbsentHomeComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the open count and its 6+ subset from the summary only', () => {
    api.summary.and.returnValue(of(longAbsenceSummaryFixture({ totalCount: 9, uncontactedCount: 4, atLeastSixMonthsCount: 2 })));
    const el = render();
    expect(el.querySelector('[data-testid="home-long-absent-open"]')?.textContent?.trim()).toBe('4');
    expect(el.querySelector('[data-testid="home-long-absent-six"]')?.textContent).toContain('6개월+ 2명');
    expect(el.textContent).not.toContain('9');
    expect(api.list).not.toHaveBeenCalled();
  });

  it('shows a successful 0 as 0', () => {
    api.summary.and.returnValue(of(longAbsenceSummaryFixture({ uncontactedCount: 0, atLeastSixMonthsCount: 0 })));
    expect(render().querySelector('[data-testid="home-long-absent-open"]')?.textContent?.trim()).toBe('0');
  });

  it('shows — and a retry on error, never 0', () => {
    api.summary.and.returnValue(throwError(() => new Error('down')));
    const fixture = TestBed.createComponent(LongAbsentHomeComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="home-long-absent-open"]')).toBeNull();
    expect(el.querySelector('[data-testid="home-long-absent-error"]')?.textContent).toContain('—');

    api.summary.and.returnValue(of(longAbsenceSummaryFixture({ uncontactedCount: 3 })));
    (el.querySelector('[data-testid="home-long-absent-error"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="home-long-absent-open"]')?.textContent?.trim()).toBe('3');
  });

  it('links 명단 보기 straight to the 장기결석자 tab, without any member data', () => {
    api.summary.and.returnValue(of(longAbsenceSummaryFixture()));
    const link = render().querySelector('[data-testid="home-long-absent-link"]') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/analytics/long-absences');
  });
});
