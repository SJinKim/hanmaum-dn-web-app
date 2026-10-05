import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';

import {
  RECONCILIATION_STATUSES,
  Reconciliation,
  ReconciliationStatus,
  reconciliationValue,
} from '../../../core/models/reconciliation.model';
import { BadgeComponent } from '../../../core/ui/badge/badge.component';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
import { FilterChipComponent } from '../../../core/ui/filter-chip/filter-chip.component';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';
import { BadgeVariant } from '../../../core/ui/variant-tokens';
import { ReconciliationService } from '../reconciliation.service';

const PAGE_SIZE = 20;

export const STATUS_BADGE: Record<ReconciliationStatus, BadgeVariant> = {
  OPEN: 'pending',
  LINKED: 'active',
  DISMISSED: 'inactive',
};

interface Row {
  readonly item: Reconciliation;
  readonly name: string;
  readonly reasons: string;
  readonly fields: string | null;
}

/**
 * 계정 연결 확인 (#45), Figma 1027:105623. Registrations the server could not
 * match to an existing account on its own wait here as 대기 until the 새가족팀
 * links or dismisses them.
 */
@Component({
  selector: 'app-newcomer-reconciliations',
  standalone: true,
  imports: [
    DatePipe,
    TranslatePipe,
    ButtonModule,
    BadgeComponent,
    EmptyStateComponent,
    FilterChipComponent,
    PageHeaderComponent,
    SkeletonComponent,
  ],
  host: { class: 'flex flex-col' },
  templateUrl: './newcomer-reconciliations.component.html',
})
export class NewcomerReconciliationsComponent implements OnInit {
  private readonly service = inject(ReconciliationService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly statuses = RECONCILIATION_STATUSES;
  readonly statusBadge = STATUS_BADGE;

  readonly status = signal<ReconciliationStatus>('OPEN');
  readonly items = signal<readonly Reconciliation[]>([]);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly totalPages = signal(0);
  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly failed = signal(false);

  readonly hasMore = computed(() => this.page() + 1 < this.totalPages());

  readonly rows = computed<readonly Row[]>(() => {
    this.translate.currentLang();
    return this.items().map(item => ({
      item,
      name: reconciliationValue(item.registrationMember, 'name'),
      reasons: item.reasons.map(r => this.label('reason', r)).join(', '),
      fields: item.conflictFields.length
        ? item.conflictFields.map(f => this.label('field', f)).join(', ')
        : null,
    }));
  });

  ngOnInit(): void {
    this.load();
  }

  select(status: ReconciliationStatus): void {
    if (status === this.status()) return;
    this.status.set(status);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.fetch(0, false);
  }

  more(): void {
    if (this.loadingMore() || !this.hasMore()) return;
    this.loadingMore.set(true);
    this.fetch(this.page() + 1, true);
  }

  open(item: Reconciliation): void {
    void this.router.navigate(['/newcomers', 'reconciliations', item.publicId]);
  }

  goToList(): void {
    void this.router.navigate(['/newcomers']);
  }

  private fetch(page: number, append: boolean): void {
    const status = this.status();
    this.service
      .list(status, page, PAGE_SIZE)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (status !== this.status()) return;
          this.items.update(list => (append ? [...list, ...res.content] : res.content));
          this.total.set(res.totalElements);
          this.page.set(res.number);
          this.totalPages.set(res.totalPages);
          this.loading.set(false);
          this.loadingMore.set(false);
        },
        error: () => {
          if (status !== this.status()) return;
          this.loadingMore.set(false);
          this.loading.set(false);
          if (!append) this.failed.set(true);
        },
      });
  }

  /** A server value without a translation is shown as is, never as a key. */
  private label(group: 'reason' | 'field', value: string): string {
    const key = `newcomers.reconciliation.${group}.${value}`;
    const text = this.translate.instant(key) as string;
    return text === key ? value : text;
  }
}
