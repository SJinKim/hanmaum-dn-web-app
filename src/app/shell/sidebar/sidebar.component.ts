import { Component, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule, TooltipModule],
  templateUrl: './sidebar.component.html',
  host: { class: 'flex self-stretch' },
})
export class SidebarComponent {
  private readonly platformId = inject(PLATFORM_ID);

  readonly collapsed = signal(
    isPlatformBrowser(this.platformId) &&
    localStorage.getItem('sidebar-collapsed') === 'true'
  );

  readonly sidebarWidth = computed(() =>
    this.collapsed() ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width-expanded)'
  );

  readonly navItems: NavItem[] = [
    { label: 'Home',       icon: 'pi pi-home',          route: '/'           },
    { label: 'Members',    icon: 'pi pi-users',         route: '/members'    },
    { label: 'Ministry',   icon: 'pi pi-sitemap',       route: '/ministry'   },
    { label: 'Attendance',    icon: 'pi pi-check-square',   route: '/attendance'    },
    { label: 'Announcements', icon: 'pi pi-megaphone',      route: '/announcements' },
    { label: 'Analytics',     icon: 'pi pi-chart-bar',      route: '/analytics'     },
  ];

  toggleCollapse(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('sidebar-collapsed', String(next));
    }
  }
}
