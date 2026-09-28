import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { BreakpointService } from '../../core/ui/breakpoint.service';
import { MemberService } from '../../features/members/member.service';
import { HeaderComponent } from './header.component';

const KO = { shell: { pending: { label: '대기 {{count}}명', aria: '승인 대기 {{count}}명' } } };

function render(): ComponentFixture<HeaderComponent> {
  TestBed.configureTestingModule({
    imports: [HeaderComponent],
    providers: [
      provideRouter([]),
      provideTranslateService({ fallbackLang: 'ko' }),
      { provide: BreakpointService, useValue: { isPhone: signal(true) } },
      { provide: MemberService, useValue: { pendingCount: signal(128), refreshPendingCount: () => undefined } },
    ],
  });
  const translate = TestBed.inject(TranslateService);
  translate.setTranslation('ko', KO);
  translate.use('ko');
  TestBed.inject(AuthService).roles.set(['admin']);
  const fixture = TestBed.createComponent(HeaderComponent);
  fixture.detectChanges();
  return fixture;
}

/** Figma: Topbar Phone × HasPending (158:667), #132. */
describe('HeaderComponent on Phone', () => {
  it('labels the pending chip like Figma', () => {
    const header: HTMLElement = render().nativeElement.querySelector('header');
    expect(header.children[1].textContent).toContain('대기 128명');
  });

  it('lets the brand shrink instead of sliding under the right cluster', () => {
    const [left, right] = Array.from(render().nativeElement.querySelector('header').children) as HTMLElement[];
    expect(left.classList).toContain('min-w-0');
    expect(left.querySelector('span')?.classList).toContain('truncate');
    expect(right.classList).toContain('shrink-0');
  });

  it('keeps the popup menu out of the right cluster gap', () => {
    const right: HTMLElement = render().nativeElement.querySelector('header').children[1];
    const direct = Array.from(right.children).map(child => child.tagName.toLowerCase());
    expect(direct).not.toContain('p-menu');
  });
});
