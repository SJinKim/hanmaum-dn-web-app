import { Component, inject, computed, signal, PLATFORM_ID, ViewChild, OnInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { MenuModule } from 'primeng/menu';
import { Menu } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { AuthService } from '../../core/services/auth.service';
import { MemberService } from '../../features/members/member.service';

const THEME_KEY = 'app-theme';
const DARK_CLASS = 'app-dark';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [MenuModule],
  templateUrl: './header.component.html',
})
export class HeaderComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router     = inject(Router);
  private readonly memberSvc  = inject(MemberService);

  @ViewChild('userMenu') userMenu!: Menu;

  readonly isDark = signal(this.readInitialTheme());
  readonly pendingCount = this.memberSvc.pendingCount;
  readonly showPendingBanner = computed(() => this.auth.isAdmin() && this.pendingCount() > 0);

  readonly initials = computed(() => {
    const name = this.auth.username();
    return name ? name.slice(0, 2).toUpperCase() : 'AU';
  });

  readonly menuItems = computed<MenuItem[]>(() => [
    {
      label: this.auth.username() || 'Account',
      items: [
        { label: 'My Profile', icon: 'pi pi-user', disabled: true },
        {
          label: this.isDark() ? 'Light Theme' : 'Dark Theme',
          icon: this.isDark() ? 'pi pi-sun' : 'pi pi-moon',
          command: () => this.toggleTheme(),
        },
        { separator: true },
        { label: 'Settings', icon: 'pi pi-cog', command: () => this.router.navigate(['/settings']) },
        { label: 'Logout', icon: 'pi pi-sign-out', command: () => this.auth.logout() },
      ],
    },
  ]);

  constructor() {
    this.applyTheme(this.isDark());
  }

  ngOnInit(): void {
    if (this.auth.isAdmin()) {
      this.memberSvc.refreshPendingCount();
    }
  }

  goToPending(): void {
    this.router.navigate(['/members'], { queryParams: { status: 'PENDING' } });
  }

  toggleMenu(event: Event): void {
    this.userMenu.toggle(event);
  }

  private toggleTheme(): void {
    const next = !this.isDark();
    this.isDark.set(next);
    this.applyTheme(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    }
  }

  private applyTheme(dark: boolean): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document.documentElement.classList.toggle(DARK_CLASS, dark);
  }

  private readInitialTheme(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    return localStorage.getItem(THEME_KEY) === 'dark';
  }
}
