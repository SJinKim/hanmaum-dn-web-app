import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { SidebarComponent, SidebarMode } from './sidebar.component';

function createFixture(mode: SidebarMode = 'expanded'): ComponentFixture<SidebarComponent> {
  TestBed.configureTestingModule({
    imports: [SidebarComponent],
    providers: [
      // A catch-all route so clicking a nav link resolves instead of rejecting.
      provideRouter([{ path: '**', children: [] }]),
      provideTranslateService({ fallbackLang: 'en' }),
    ],
  });
  TestBed.inject(AuthService).roles.set(['ADMIN']);
  const fixture = TestBed.createComponent(SidebarComponent);
  fixture.componentRef.setInput('mode', mode);
  return fixture;
}

describe('SidebarComponent', () => {
  describe('mode', () => {
    it('shows labels and the collapse toggle when expanded', () => {
      const c = createFixture('expanded').componentInstance;
      expect(c.isRail()).toBeFalse();
      expect(c.showLabels()).toBeTrue();
      expect(c.showToggle()).toBeTrue();
      expect(c.width()).toBe('256px');
    });

    it('hides labels in the rail and keeps the toggle', () => {
      const c = createFixture('rail').componentInstance;
      expect(c.isRail()).toBeTrue();
      expect(c.showLabels()).toBeFalse();
      expect(c.showToggle()).toBeTrue();
      expect(c.width()).toBe('72px');
    });

    it('drops the toggle inside the drawer and takes the density width', () => {
      const c = createFixture('drawer').componentInstance;
      expect(c.showLabels()).toBeTrue();
      expect(c.showToggle()).toBeFalse();
      expect(c.width()).toBe('var(--size-sidebar)');
    });
  });

  describe('navigation', () => {
    it('renders one link per configured item, no route in the template', () => {
      const fixture = createFixture();
      fixture.detectChanges();
      const expected = fixture.componentInstance
        .groups()
        .flatMap(group => group.items)
        .map(item => item.route);
      const hrefs = Array.from(
        fixture.nativeElement.querySelectorAll('a'),
      ).map(a => (a as HTMLAnchorElement).getAttribute('href'));
      expect(hrefs).toEqual(expected);
    });

    it('marks only the root item as an exact match', () => {
      const items = createFixture().componentInstance.groups().flatMap(group => group.items);
      const exact = items.filter(item => item.linkActiveOptions.exact).map(item => item.route);
      expect(exact).toEqual(['/']);
    });


    it('emits navigate on a nav click so the drawer can close', () => {
      const fixture = createFixture('drawer');
      const spy = jasmine.createSpy('navigate');
      fixture.componentInstance.navigate.subscribe(spy);
      fixture.detectChanges();
      fixture.nativeElement.querySelector('a').click();
      expect(spy).toHaveBeenCalled();
    });
  });
});
