import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { DrawerComponent } from './drawer.component';

interface Harness {
  readonly fixture: ComponentFixture<DrawerComponent>;
  readonly component: DrawerComponent;
  readonly closed: jasmine.Spy;
  readonly links: HTMLAnchorElement[];
}

function createHarness(): Harness {
  TestBed.configureTestingModule({
    imports: [DrawerComponent],
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      provideTranslateService({ fallbackLang: 'en' }),
    ],
  });
  TestBed.inject(AuthService).roles.set(['ADMIN']);
  const fixture = TestBed.createComponent(DrawerComponent);
  const closed = jasmine.createSpy('close');
  fixture.componentInstance.dismiss.subscribe(closed);
  fixture.detectChanges();
  return {
    fixture,
    component: fixture.componentInstance,
    closed,
    links: Array.from(fixture.nativeElement.querySelectorAll('a')),
  };
}

function tab(shiftKey: boolean): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true });
}

describe('DrawerComponent', () => {
  it('closes on the scrim', () => {
    const { fixture, closed } = createHarness();
    fixture.nativeElement.querySelector('[aria-hidden="true"]').click();
    expect(closed).toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const { component, closed } = createHarness();
    component.onEscape();
    expect(closed).toHaveBeenCalled();
  });

  it('closes once a navigation completes', async () => {
    const { closed } = createHarness();
    await TestBed.inject(Router).navigateByUrl('/members');
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('closes when a nav item inside it is tapped', () => {
    const { links, closed } = createHarness();
    links[0].click();
    expect(closed).toHaveBeenCalled();
  });

  it('focuses the first nav item when it opens', () => {
    const { links } = createHarness();
    expect(document.activeElement).toBe(links[0]);
  });

  describe('focus trap', () => {
    it('wraps forward from the last item to the first', () => {
      const { component, links } = createHarness();
      links[links.length - 1].focus();
      const event = tab(false);
      component.trapFocus(event);
      expect(document.activeElement).toBe(links[0]);
      expect(event.defaultPrevented).toBeTrue();
    });

    it('wraps backward from the first item to the last', () => {
      const { component, links } = createHarness();
      links[0].focus();
      const event = tab(true);
      component.trapFocus(event);
      expect(document.activeElement).toBe(links[links.length - 1]);
      expect(event.defaultPrevented).toBeTrue();
    });

    it('pulls focus back in when it sits outside the panel', () => {
      const { component, links } = createHarness();
      document.body.focus();
      component.trapFocus(tab(false));
      expect(document.activeElement).toBe(links[0]);
    });
  });
});
