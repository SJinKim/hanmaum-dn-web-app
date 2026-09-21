import { computed, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { Breakpoint, BreakpointService } from '../core/ui/breakpoint.service';
import { ShellComponent } from './shell.component';

/** Drives the shell's layout decisions without touching `matchMedia`. */
class FakeBreakpointService {
  readonly current = signal<Breakpoint>('desktop');
  readonly isPhone = computed(() => this.current() === 'phone');
  readonly isTablet = computed(() => this.current() === 'tablet');
  readonly isDesktop = computed(() => this.current() === 'desktop');
}

const COLLAPSED_KEY = 'sidebar-collapsed';

describe('ShellComponent', () => {
  let breakpoint: FakeBreakpointService;

  function createShell(): ShellComponent {
    return TestBed.createComponent(ShellComponent).componentInstance;
  }

  beforeEach(() => {
    localStorage.removeItem(COLLAPSED_KEY);
    TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        { provide: BreakpointService, useClass: FakeBreakpointService },
        provideRouter([{ path: '**', children: [] }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ fallbackLang: 'en' }),
      ],
    });
    breakpoint = TestBed.inject(BreakpointService) as unknown as FakeBreakpointService;
  });

  afterAll(() => localStorage.removeItem(COLLAPSED_KEY));

  describe('sidebar per breakpoint', () => {
    it('is expanded on desktop', () => {
      const shell = createShell();
      expect(shell.showSidebar()).toBeTrue();
      expect(shell.sidebarMode()).toBe('expanded');
    });

    it('is a rail on tablet', () => {
      breakpoint.current.set('tablet');
      const shell = createShell();
      expect(shell.showSidebar()).toBeTrue();
      expect(shell.sidebarMode()).toBe('rail');
    });

    it('is absent on phone, where the drawer carries the nav', () => {
      breakpoint.current.set('phone');
      expect(createShell().showSidebar()).toBeFalse();
    });
  });

  describe('collapse toggle', () => {
    it('turns the desktop sidebar into a rail and back', () => {
      const shell = createShell();
      shell.toggleSidebar();
      expect(shell.sidebarMode()).toBe('rail');
      shell.toggleSidebar();
      expect(shell.sidebarMode()).toBe('expanded');
    });

    it('persists the preference for the next shell', () => {
      createShell().toggleSidebar();
      expect(localStorage.getItem(COLLAPSED_KEY)).toBe('true');
      expect(createShell().sidebarMode()).toBe('rail');
    });
  });

  describe('drawer', () => {
    it('only renders on phone, and only while open', () => {
      const shell = createShell();
      shell.openDrawer();
      expect(shell.showDrawer()).toBeFalse();

      breakpoint.current.set('phone');
      expect(shell.showDrawer()).toBeTrue();

      shell.closeDrawer();
      expect(shell.showDrawer()).toBeFalse();
    });
  });
});
