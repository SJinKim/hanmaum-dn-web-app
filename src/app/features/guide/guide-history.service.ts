import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, Subject, catchError, defer, finalize, forkJoin, map, of, switchMap, tap, throwError } from 'rxjs';
import { PageResponse } from '../../core/models/api-response.model';
import { GuideReport, guideYear } from './guide-report.model';
import { GuideReportsApi } from './guide-reports-api.service';

interface HistoryQuery { year: number; page: number; size: number }
const emptyPage: PageResponse<GuideReport> = { content: [], number: 0, size: 6, totalElements: 0, totalPages: 0 };

@Injectable({ providedIn: 'root' })
export class GuideHistoryService {
  private readonly api = inject(GuideReportsApi);
  private readonly destroy = inject(DestroyRef);
  private readonly requests = new Subject<HistoryQuery>();
  readonly query = signal<HistoryQuery>({ year: guideYear(), page: 0, size: 6 });
  readonly page = signal<PageResponse<GuideReport>>(emptyPage);
  readonly latest = signal<GuideReport | null>(null);
  readonly previous = signal<GuideReport | null>(null);
  readonly years = signal<number[]>([guideYear()]);
  readonly hasAnyRecords = signal(false);
  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  readonly deleting = signal(false);
  readonly notice = signal<'deleteFailed' | 'deleteConflict' | 'deleteMissing' | 'waitForDelete' | null>(null);

  constructor() {
    this.requests.pipe(switchMap(query => defer(() => {
      this.loading.set(true); this.loadFailed.set(false);
      const range = { from: `${query.year.toString().padStart(4, '0')}-01-01`, to: `${query.year.toString().padStart(4, '0')}-12-31` };
      return this.api.list({ ...range, page: query.page, size: query.size }).pipe(
        // Deleting the last row of a page must not strand the user on an empty page.
        switchMap(page => page.number > 0 && !page.content.length
          ? this.api.list({ ...range, page: Math.max(0, Math.ceil(page.totalElements / query.size) - 1), size: query.size }) : of(page)),
        switchMap(page => forkJoin({
          page: of(page),
          newest: page.number === 0 ? of(page.content[0] ?? null)
            : this.api.list({ ...range, page: 0, size: 1 }).pipe(map(p => p.content[0] ?? null)),
          first: this.api.list({ page: 0, size: 1, sort: 'serviceDate,asc' }),
          last: this.api.list({ page: 0, size: 1 }),
        })),
        switchMap(data => (data.newest ? this.api.previous(data.newest.serviceDate) : of(null)).pipe(map(previous => ({ ...data, previous })))),
        tap(data => {
          this.page.set(data.page); this.query.set({ ...query, page: data.page.number });
          this.latest.set(data.newest); this.previous.set(data.previous);
          this.hasAnyRecords.set(data.last.totalElements > 0);
          const min = Math.min(guideYear(), query.year, Number(data.first.content[0]?.serviceDate.slice(0, 4) ?? guideYear()));
          const max = Math.max(guideYear(), query.year, Number(data.last.content[0]?.serviceDate.slice(0, 4) ?? guideYear()));
          this.years.set(Array.from({ length: max - min + 1 }, (_, i) => max - i));
        }),
        catchError(() => { this.loadFailed.set(true); return EMPTY; }),
        finalize(() => this.loading.set(false)),
      );
    })), takeUntilDestroyed(this.destroy)).subscribe();
  }

  load(patch: Partial<HistoryQuery> = {}): void {
    const query = { ...this.query(), ...patch };
    if (!Number.isInteger(query.year) || query.year < 1 || query.year > 9999 || !Number.isInteger(query.page) || query.page < 0
      || !Number.isInteger(query.size) || query.size < 1 || query.size > 200) return;
    this.query.set(query); this.requests.next(query);
  }

  remove(report: GuideReport) {
    if (this.deleting()) return throwError(() => new Error('Deletion in progress'));
    this.deleting.set(true); this.notice.set(null);
    return this.api.remove(report).pipe(
      tap(() => this.load()),
      catchError((error: unknown) => {
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        this.notice.set(status === 409 ? 'deleteConflict' : status === 404 ? 'deleteMissing' : 'deleteFailed');
        if (status === 409 || status === 404) this.load();
        return throwError(() => error);
      }), finalize(() => this.deleting.set(false)),
    );
  }
}
