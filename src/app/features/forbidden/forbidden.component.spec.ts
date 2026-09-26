import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { ForbiddenComponent } from './forbidden.component';

const KO = {
  forbidden: {
    eyebrow: '403',
    title: '접근 권한 없음',
    subtitle: '이 화면은 권한이 있는 계정에게만 열려 있습니다.',
    empty: { heading: '접근 권한이 없습니다', description: '설명', action: '홈으로 이동' },
  },
};

describe('ForbiddenComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ForbiddenComponent],
      providers: [provideRouter([]), provideTranslateService({ fallbackLang: 'ko' })],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('ko', KO);
    translate.use('ko');
  });

  it('renders the Figma copy with the ban icon', () => {
    const fixture = TestBed.createComponent(ForbiddenComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('접근 권한 없음');
    expect(el.textContent).toContain('접근 권한이 없습니다');
    expect(el.querySelector('i.pi-ban')).not.toBeNull();
  });

  it('goes home from 홈으로 이동', () => {
    const fixture = TestBed.createComponent(ForbiddenComponent);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.componentInstance.goHome();
    expect(navigate).toHaveBeenCalledWith(['/']);
  });
});
