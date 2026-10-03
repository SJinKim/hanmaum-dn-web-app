import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthService } from '../../core/services/auth.service';
import { RoleService } from '../../core/services/role.service';
import { EmptyStateComponent } from '../../core/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header.component';

/** Keycloak's built-in roles say nothing about what the user may see. */
const TECHNICAL_ROLE = /^(default-roles-.*|offline_access|uma_authorization)$/i;

/**
 * Figma: 접근 권한 없음 · Desktop · Light (745:41755), and its "화면 준비 중"
 * variant (879:210 Light, 879:370 Dark) for a role without any screen yet.
 */
@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [TranslatePipe, EmptyStateComponent, PageHeaderComponent],
  // Fills `<main>` so the empty state can take the rest of the height and sit
  // vertically centred, as in Figma (745:41755, Phone 781:96125; #136).
  host: { class: 'flex h-full flex-col' },
  template: `
    <div class="flex flex-1 flex-col gap-gutter">
      @if (noPage()) {
        <app-page-header
          [eyebrow]="'forbidden.eyebrow' | translate"
          [heading]="'forbidden.noPage.title' | translate"
          [subtitle]="'forbidden.noPage.subtitle' | translate" />
        <app-empty-state
          class="flex flex-1"
          variant="no-data"
          iconClass="pi pi-clock"
          [heading]="'forbidden.noPage.heading' | translate"
          [description]="'forbidden.noPage.description' | translate: { roles: roleList() }"
          [actionLabel]="'forbidden.noPage.action' | translate"
          actionIcon="pi pi-sign-out"
          (action)="logout()" />
      } @else {
        <app-page-header
          [eyebrow]="'forbidden.eyebrow' | translate"
          [heading]="'forbidden.title' | translate"
          [subtitle]="'forbidden.subtitle' | translate" />
        <app-empty-state
          class="flex flex-1"
          variant="error"
          iconClass="pi pi-ban"
          [heading]="'forbidden.empty.heading' | translate"
          [description]="'forbidden.empty.description' | translate"
          [actionLabel]="'forbidden.empty.action' | translate"
          (action)="goHome()" />
      }
    </div>
  `,
})
export class ForbiddenComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly roles = inject(RoleService);

  /** No readable screen besides home: "go home" would only loop back here. */
  protected readonly noPage = computed(() => !this.roles.hasWebAccess());

  protected readonly roleList = computed(
    () =>
      this.auth
        .roles()
        .filter(role => !TECHNICAL_ROLE.test(role))
        .join(', ') || '–',
  );

  goHome(): void {
    void this.router.navigate(['/']);
  }

  logout(): void {
    this.auth.logout();
  }
}
