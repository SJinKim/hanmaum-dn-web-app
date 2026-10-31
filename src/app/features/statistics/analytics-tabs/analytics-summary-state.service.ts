import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, switchMap } from 'rxjs';
import { readApiError } from '../../../core/http/api-error';
import { LongAbsenceSummary } from '../../../core/models/long-absent.model';
import { LongAbsentApi } from '../../../core/services/long-absent-api.service';

type SummaryResult = { summary: LongAbsenceSummary } | { failed: true; forbidden: boolean };

/**
 * The memo-free 장기결석자 counts behind the tab counter (#277). Provided per
 * routed page, so leaving the page drops it; never loads the person list.
 * `switchMap` drops an answer that a newer request has overtaken.
 */
@Injectable()
export class AnalyticsSummaryState {
  private readonly api = inject(LongAbsentApi);
  private readonly requests = new Subject<void>();

  readonly summary = signal<LongAbsenceSummary | null>(null);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly forbidden = signal(false);
  /** Unknown while loading or after an error — never a made-up 0. */
  readonly openCount = computed(() => this.summary()?.uncontactedCount ?? null);

  constructor() {
    this.requests
      .pipe(
        switchMap(() =>
          this.api.summary().pipe(
            map((summary): SummaryResult => ({ summary })),
            catchError((err: unknown) => of<SummaryResult>({ failed: true, forbidden: readApiError(err)?.status === 403 })),
          ),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(result => {
        this.loading.set(false);
        if ('summary' in result) {
          this.summary.set(result.summary);
          this.failed.set(false);
          return;
        }
        this.summary.set(null);
        this.failed.set(true);
        this.forbidden.set(result.forbidden);
      });
  }

  load(): void {
    if (this.forbidden()) return;
    this.loading.set(true);
    this.failed.set(false);
    this.requests.next();
  }

  /** After a 403 elsewhere on the page: no further requests, nothing kept. */
  revoke(): void {
    this.forbidden.set(true);
    this.summary.set(null);
    this.loading.set(false);
  }
}
