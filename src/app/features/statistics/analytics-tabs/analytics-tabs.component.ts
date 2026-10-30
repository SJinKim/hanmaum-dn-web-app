import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * 통계 · 장기결석자 tabs (#277, Figma Section „02 · 통계“). Real links, so
 * deep links, reload, a new browser tab and back/forward all go through the
 * router. Presentation only: the page owns the counter state.
 */
@Component({
  selector: 'app-analytics-tabs',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  template: `
    <nav class="border-line flex gap-[var(--space-4)] border-b" [attr.aria-label]="'statistics.tabs.label' | translate">
      <a
        class="type-body-sm text-ink-muted hover:text-ink -mb-px flex min-h-[44px] items-center gap-[var(--space-8)] border-b-2 border-transparent px-[var(--space-12)] focus-visible:[outline:2px_solid_var(--color-focus)] focus-visible:[outline-offset:-2px]"
        routerLink="/analytics"
        routerLinkActive="!border-action !text-ink-strong font-semibold"
        ariaCurrentWhenActive="page"
        [routerLinkActiveOptions]="{ exact: true }"
        data-testid="tab-statistics">
        {{ 'statistics.tabs.statistics' | translate }}
      </a>
      <a
        class="type-body-sm text-ink-muted hover:text-ink -mb-px flex min-h-[44px] items-center gap-[var(--space-8)] border-b-2 border-transparent px-[var(--space-12)] focus-visible:[outline:2px_solid_var(--color-focus)] focus-visible:[outline-offset:-2px]"
        routerLink="/analytics/long-absences"
        routerLinkActive="!border-action !text-ink-strong font-semibold"
        ariaCurrentWhenActive="page"
        data-testid="tab-long-absent">
        {{ 'statistics.tabs.longAbsent' | translate }}
        @if (count() !== null) {
          <span class="tabular-nums" data-testid="tab-count">· {{ count() }}</span>
        } @else if (loading()) {
          <span class="text-ink-disabled" data-testid="tab-count-loading" [attr.aria-label]="'statistics.tabs.countLoading' | translate">· …</span>
        }
      </a>
      @if (failed() && !loading()) {
        <button
          class="type-caption text-ink-muted hover:text-ink flex items-center gap-[var(--space-4)] self-center rounded-[var(--radius-sm)] px-[var(--space-8)] focus-visible:[outline:2px_solid_var(--color-focus)]"
          type="button"
          data-testid="tab-count-retry"
          (click)="retry.emit()">
          <i class="pi pi-refresh text-[12px]" aria-hidden="true"></i>
          {{ 'statistics.tabs.countFailed' | translate }}
        </button>
      }
    </nav>
  `,
})
export class AnalyticsTabsComponent {
  /** Open (not contacted) people; `null` while unknown. */
  readonly count = input<number | null>(null);
  readonly loading = input(false);
  readonly failed = input(false);
  readonly retry = output<void>();
}
