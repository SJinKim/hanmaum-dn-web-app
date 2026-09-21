import {
  Component,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Menu, MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { MemberService } from '../../features/members/member.service';
import { AppLang, DEFAULT_LANG, LANG_STORAGE_KEY } from '../../core/i18n/language';
import { AvatarComponent } from '../../core/ui/avatar/avatar.component';
import { BadgeComponent } from '../../core/ui/badge/badge.component';
import { BreakpointService } from '../../core/ui/breakpoint.service';

const THEME_KEY = 'app-theme';

/**
 * Figma: Topbar (158:668) — Breakpoint Desktop/Tablet/Phone × HasPending.
 *
 * Theme and language moved out of the avatar menu into their own icon buttons,
 * where Figma puts them; the menu keeps what has no icon slot in the bar
 * (profile, settings, logout). Figma has no sidebar entry for Settings, so the
 * menu stays its only route.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [MenuModule, TranslatePipe, AvatarComponent, BadgeComponent],
  templateUrl: './header.component.html',
})
export class HeaderComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);
  private readonly memberSvc = inject(MemberService);
  private readonly translate = inject(TranslateService);
  private readonly breakpoint = inject(BreakpointService);

  private readonly userMenu = viewChild.required<Menu>('userMenu');

  /** Phone only: opens the Drawer (157:1738); the shell owns the open state. */
  readonly drawerToggle = output<void>();

  readonly isPhone = this.breakpoint.isPhone;
  readonly isDark = signal(this.readInitialTheme());
  readonly lang = signal<AppLang>(this.readInitialLang());
  readonly pendingCount = this.memberSvc.pendingCount;
  readonly showPending = computed(() => this.auth.isAdmin() && this.pendingCount() > 0);

  readonly accountName = computed(() => this.auth.username() || 'Account');

  readonly menuItems = computed<MenuItem[]>(() => {
    // PrimeNG takes plain strings, so the labels are resolved eagerly; reading the
    // language signal is what re-resolves them when the user switches language.
    this.translate.currentLang();
    return [
      {
        label: this.accountName(),
        items: [
          { label: this.translate.instant('shell.menu.profile'), icon: 'pi pi-user', disabled: true },
          {
            label: this.translate.instant('shell.menu.settings'),
            icon: 'pi pi-cog',
            command: () => void this.router.navigate(['/settings']),
          },
          { separator: true },
          {
            label: this.translate.instant('shell.menu.logout'),
            icon: 'pi pi-sign-out',
            command: () => this.auth.logout(),
          },
        ],
      },
    ];
  });

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
    void this.router.navigate(['/members'], { queryParams: { status: 'PENDING' } });
  }

  toggleMenu(event: Event): void {
    this.userMenu().toggle(event);
  }

  toggleTheme(): void {
    const next = !this.isDark();
    this.isDark.set(next);
    this.applyTheme(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    }
  }

  toggleLang(): void {
    const next: AppLang = this.lang() === 'ko' ? 'en' : 'ko';
    this.lang.set(next);
    this.translate.use(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(LANG_STORAGE_KEY, next);
    }
    this.applyLang(next);
  }

  /**
   * `data-theme` is the single dark-mode hook: styles.scss redefines the tokens
   * under `[data-theme="dark"]` and PrimeNG is configured on the same selector
   * in app.config.ts. The former `.app-dark` class switched neither.
   */
  private applyTheme(dark: boolean): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }

  private readInitialTheme(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    return localStorage.getItem(THEME_KEY) === 'dark';
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
