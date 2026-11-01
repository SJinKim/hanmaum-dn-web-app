import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, map, of, switchMap } from 'rxjs';
import { readApiError } from '../../../core/http/api-error';
import { LongAbsenceHistoryItem, LongAbsencePage } from '../../../core/models/long-absent.model';
import { LongAbsentApi } from '../../../core/services/long-absent-api.service';

export type LongAbsentHistoryStatus = 'idle' | 'loading' | 'ready' | 'error' | 'forbidden';

type Answer = { page: LongAbsencePage<LongAbsenceHistoryItem> } | { error: unknown };

/**
 * Closed 장기결석 phases (#279 AK 3): the global, server-paged history table. It
 * keeps a person reachable after 복귀 took them off the current list. Holds no
 * memo — the server sends none here. Provided by the page, gone with it.
 */
@Injectable()
export class LongAbsentHistoryState {
  private readonly api = inject(LongAbsentApi);
  /** `null` cancels a running read. */
  private readonly reads = new Subject<number | null>();

  readonly status = signal<LongAbsentHistoryStatus>('idle');
  readonly items = signal<readonly LongAbsenceHistoryItem[]>([]);
  /** Zero-based page shown, and the server's totals for the pager. */
  readonly page = signal(0);
  readonly totalElements = signal(0);
  readonly totalPages = signal(0);
  readonly pageSize = signal(0);

  constructor() {
    this.reads
      .pipe(
        switchMap(page =>
          page === null
            ? EMPTY
            : this.api.history(page).pipe(
                map((result): Answer => ({ page: result })),
                catchError((error: unknown) => of<Answer>({ error })),
              ),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(answer => {
        if ('page' in answer) {
          const result = answer.page;
          // A page beyond the end (rows moved meanwhile) falls back to the last one.
          if (result.items.length === 0 && result.page > 0 && result.totalPages > 0) {
            this.load(result.totalPages - 1);
            return;
          }
          this.items.set(result.items);
          this.page.set(result.page);
          this.pageSize.set(result.size);
          this.totalElements.set(result.totalElements);
          this.totalPages.set(result.totalPages);
          this.status.set('ready');
        } else if (readApiError(answer.error)?.status === 403) {
          this.revoke();
        } else {
          this.items.set([]);
          this.status.set('error');
        }
      });
  }

  load(page = 0): void {
    if (this.status() === 'forbidden') return;
    this.status.set('loading');
    this.reads.next(Math.max(0, page));
  }

  /** After any write: pages may have shifted, so back to the first one. */
  reload(): void {
    if (this.status() === 'idle' || this.status() === 'forbidden') return;
    this.load(0);
  }

  revoke(): void {
    this.reads.next(null);
    this.items.set([]);
    this.totalElements.set(0);
    this.totalPages.set(0);
    this.status.set('forbidden');
  }
}
