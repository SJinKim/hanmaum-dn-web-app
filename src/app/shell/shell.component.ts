import { Component, PLATFORM_ID, computed, effect, inject, signal, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BreakpointService } from '../core/ui/breakpoint.service';
import { DrawerComponent } from './drawer/drawer.component';
import { HeaderComponent } from './header/header.component';
import { SidebarComponent, SidebarMode } from './sidebar/sidebar.component';

const COLLAPSED_KEY = 'sidebar-collapsed';

/**
 * Figma: Desktop 188:2 · Tablet 228:171 · Phone 237:1901 / 248:15804.
 *
 * Sidebar left, Topbar above the content, content padded with `space/page`. The
 * breakpoint decides the default — expanded on Desktop, rail on Tablet, no
 * sidebar at all on Phone — and the collapse toggle overrides it on the two
 * viewports that have a sidebar. The override lives here, not in the sidebar,
 * because it survives navigation. Desktop persists it per browser; on Tablet
 * the sidebar opens only until the next reload or breakpoint change (#208).
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterModule, SidebarComponent, HeaderComponent, DrawerComponent],
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly breakpoint = inject(BreakpointService);

  readonly isPhone = this.breakpoint.isPhone;

  private readonly collapsed = signal(this.readCollapsed());
  private readonly tabletExpanded = signal(false);
  private readonly drawerOpen = signal(false);

  /** Phone has no sidebar — the same nav renders inside the Drawer instead. */
  readonly showSidebar = computed(() => !this.isPhone());
  readonly showDrawer = computed(() => this.isPhone() && this.drawerOpen());

  readonly sidebarMode = computed<SidebarMode>(() => {
    if (this.breakpoint.isTablet()) {
      return this.tabletExpanded() ? 'expanded' : 'rail';
    }
    return this.collapsed() ? 'rail' : 'expanded';
  });

  constructor() {
    // Leaving Tablet drops the temporary expansion, so returning shows the rail again.
    effect(() => {
      if (!this.breakpoint.isTablet()) {
        untracked(() => this.tabletExpanded.set(false));
      }
    });
  }

  toggleSidebar(): void {
    if (this.breakpoint.isTablet()) {
      this.tabletExpanded.update(expanded => !expanded);
      return;
    }
    const next = !this.collapsed();
    this.collapsed.set(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(COLLAPSED_KEY, String(next));
    }
  }

  openDrawer(): void {
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  private readCollapsed(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  }
}
