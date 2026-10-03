import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { ForbiddenComponent } from './forbidden.component';

const KO = {
  forbidden: {
    eyebrow: '403',
    title: '접근 권한 없음',
    subtitle: '이 화면은 권한이 있는 계정에게만 열려 있습니다.',
    empty: { heading: '접근 권한이 없습니다', description: '설명', action: '홈으로 이동' },
    noPage: {
      title: '화면 준비 중',
      subtitle: '현재 역할에 연결된 화면이 아직 없습니다.',
      heading: '이 역할에 제공되는 화면이 아직 없습니다',
      description: '현재 역할: {{roles}}.',
      action: '로그아웃',
    },
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
    TestBed.inject(AuthService).roles.set(['admin']);
  });

  it('renders the Figma copy with the ban icon', () => {
    const fixture = TestBed.createComponent(ForbiddenComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('접근 권한 없음');
    expect(el.textContent).toContain('접근 권한이 없습니다');
    expect(el.querySelector('i.pi-ban')).not.toBeNull();
  });

  it('shows 홈으로 이동 without an icon and lets the empty state fill the page (#136)', () => {
    const fixture = TestBed.createComponent(ForbiddenComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.pi-home')).toBeNull();
    expect(el.classList).toContain('h-full');
    expect(el.querySelector('app-empty-state')!.classList).toContain('flex-1');
  });

  it('goes home from 홈으로 이동', () => {
    const fixture = TestBed.createComponent(ForbiddenComponent);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture.componentInstance.goHome();
    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  describe('for a role without any screen', () => {
    beforeEach(() =>
      TestBed.inject(AuthService).roles.set(['member', 'offline_access', 'default-roles-hanmaum']),
    );

    it('says no page is ready yet and names the real roles only', () => {
      const fixture = TestBed.createComponent(ForbiddenComponent);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('화면 준비 중');
      expect(el.textContent).toContain('현재 역할: member.');
      expect(el.textContent).not.toContain('offline_access');
      expect(el.querySelector('i.pi-clock')).not.toBeNull();
      expect(el.querySelector('i.pi-ban')).toBeNull();
    });

    it('logs out instead of going home', () => {
      const fixture = TestBed.createComponent(ForbiddenComponent);
      const logout = spyOn(TestBed.inject(AuthService), 'logout');
      fixture.componentInstance.logout();
      expect(logout).toHaveBeenCalled();
    });
  });
});
