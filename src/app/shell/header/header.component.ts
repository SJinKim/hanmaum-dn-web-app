import { Component, inject, computed, signal, PLATFORM_ID, ViewChild, OnInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { MenuModule } from 'primeng/menu';
import { Menu } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { MemberService } from '../../features/members/member.service';
import { AppLang, DEFAULT_LANG, LANG_STORAGE_KEY } from '../../core/i18n/language';

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
  private readonly translate  = inject(TranslateService);

  @ViewChild('userMenu') userMenu!: Menu;

  readonly isDark = signal(this.readInitialTheme());
  readonly lang   = signal<AppLang>(this.readInitialLang());
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
        {
          label: this.lang() === 'ko' ? 'English' : '한국어',
          icon: 'pi pi-globe',
          command: () => this.toggleLang(),
        },
        { label: 'Logout', icon: 'pi pi-sign-out', command: () => this.auth.logout() },
      ],
    },
  ]);

  constructor() {
    this.applyTheme(this.isDark());
    this.applyLang(this.lang());
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

  private toggleLang(): void {
    const next: AppLang = this.lang() === 'ko' ? 'en' : 'ko';
    this.lang.set(next);
    this.translate.use(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    }
    this.applyLang(next);
  }

  private applyLang(lang: AppLang): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document.documentElement.lang = lang;
  }

  private readInitialLang(): AppLang {
    if (!isPlatformBrowser(this.platformId)) return DEFAULT_LANG;
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    return stored === 'en' || stored === 'ko' ? stored : DEFAULT_LANG;
  }
}
