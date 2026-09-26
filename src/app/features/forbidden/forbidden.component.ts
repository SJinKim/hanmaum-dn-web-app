import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { EmptyStateComponent } from '../../core/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../core/ui/page-header/page-header.component';

/** Figma: 접근 권한 없음 · Desktop · Light (745:41755). */
@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [TranslatePipe, EmptyStateComponent, PageHeaderComponent],
  template: `
    <div class="flex flex-col gap-gutter">
      <app-page-header
        [eyebrow]="'forbidden.eyebrow' | translate"
        [heading]="'forbidden.title' | translate"
        [subtitle]="'forbidden.subtitle' | translate" />
      <app-empty-state
        variant="error"
        iconClass="pi pi-ban"
        [heading]="'forbidden.empty.heading' | translate"
        [description]="'forbidden.empty.description' | translate"
        [actionLabel]="'forbidden.empty.action' | translate"
        actionIcon="pi pi-home"
        (action)="goHome()" />
    </div>
  `,
})
export class ForbiddenComponent {
  private readonly router = inject(Router);

  goHome(): void {
    void this.router.navigate(['/']);
  }
}
