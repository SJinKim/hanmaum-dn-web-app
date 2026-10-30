import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { LongAbsenceSummary } from '../../core/models/long-absent.model';
import { LongAbsentApi } from '../../core/services/long-absent-api.service';
import { BadgeComponent } from '../../core/ui/badge/badge.component';
import { IconTileComponent } from '../../core/ui/icon-tile/icon-tile.component';
import { SkeletonComponent } from '../../core/ui/skeleton/skeleton.component';

/**
 * 장기결석자 · 미연락 (#277, Figma Home 190:1842 / 188:2) for pastor and admin.
 * Reads the memo-free summary only — no names, no memos — and has its own
 * loading, error and retry, so a failure here leaves the other blocks alone.
 * 명단 보기 opens the 장기결석자 tab, which starts on the 미연락 filter.
 */
@Component({
  selector: 'app-long-absent-home',
  standalone: true,
  imports: [RouterLink, TranslatePipe, ButtonModule, BadgeComponent, IconTileComponent, SkeletonComponent],
  host: { class: 'flex flex-1 min-w-0' },
  template: `
    <div
      class="bg-surface border-line-subtle shadow-elevation-sm flex flex-1 items-center gap-[var(--space-12)] rounded-[var(--radius-lg)] border p-card"
      data-testid="home-long-absent">
      <app-icon-tile icon="pi pi-user-minus" />
      <span class="flex min-w-px flex-1 flex-col">
        <span class="type-caption text-ink-muted">{{ 'home.attention.longAbsent' | translate }}</span>
        @if (loading()) {
          <app-skeleton variant="line" width="64px" />
        } @else if (summary(); as data) {
          <span class="flex flex-wrap items-center gap-[var(--space-8)]">
            <span class="type-h2 text-ink-strong tabular-nums" data-testid="home-long-absent-open">{{ data.uncontactedCount }}</span>
            <span data-testid="home-long-absent-six">
              <app-badge
                variant="urgency-6"
                [label]="'home.attention.longAbsentSixPlus' | translate: { count: data.atLeastSixMonthsCount }" />
            </span>
          </span>
        } @else {
          <span class="flex items-center gap-[var(--space-8)]" data-testid="home-long-absent-error">
            <span class="type-h2 text-ink-strong">—</span>
            <p-button
              size="small"
              severity="secondary"
              [text]="true"
              icon="pi pi-refresh"
              [label]="'home.attention.retry' | translate"
              (onClick)="load()" />
          </span>
        }
      </span>
      <a
        pButton
        size="small"
        severity="secondary"
        [outlined]="true"
        routerLink="/analytics/long-absences"
        data-testid="home-long-absent-link">
        {{ 'home.attention.longAbsentOpen' | translate }}
      </a>
    </div>
  `,
})
export class LongAbsentHomeComponent {
  private readonly api = inject(LongAbsentApi);
  private readonly destroy = inject(DestroyRef);

  readonly summary = signal<LongAbsenceSummary | null>(null);
  readonly loading = signal(true);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .summary()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: summary => {
          this.summary.set(summary);
          this.loading.set(false);
        },
        error: () => {
          this.summary.set(null);
          this.loading.set(false);
        },
      });
  }
}
