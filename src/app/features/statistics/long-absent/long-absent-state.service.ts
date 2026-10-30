import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, catchError, finalize, map, of, switchMap } from 'rxjs';
import { readApiError } from '../../../core/http/api-error';
import {
  LongAbsence,
  LongAbsenceContactStatusRequest,
  LongAbsenceMemoUpdate,
} from '../../../core/models/long-absent.model';
import { LongAbsentApi } from '../../../core/services/long-absent-api.service';

export type LongAbsentFilter = 'open' | 'all' | 'done';
export type LongAbsentStatus = 'loading' | 'ready' | 'error' | 'forbidden';

/**
 * How a write ended. `conflict` (409: the phase or version moved on) and
 * `notFound` (404) reload the list; `forbidden` drops every person and memo.
 * None of them is ever retried automatically.
 */
export type LongAbsentWriteResult = 'saved' | 'conflict' | 'notFound' | 'forbidden' | 'failed';

/** `quiet` keeps the rows on screen and reports a failure instead of the error state. */
interface ReadRequest {
  readonly quiet: boolean;
}

/**
 * 장기결석자 follow-up (#277). Provided by the page, so the list and every memo
 * go away with it — no storage, no URL, no global cache. Keeps the server order
 * (longest absence first) and filters on a copy.
 */
@Injectable()
export class LongAbsentState {
  private readonly api = inject(LongAbsentApi);
  /** `null` cancels a running read, so an older snapshot cannot overwrite a write. */
  private readonly reads = new Subject<ReadRequest | null>();
  private readonly refreshFailedEvents = new Subject<void>();

  readonly rows = signal<readonly LongAbsence[]>([]);
  readonly status = signal<LongAbsentStatus>('loading');
  /** AK 4: the work list — not contacted — is the default. */
  readonly filter = signal<LongAbsentFilter>('open');
  /** `memberPublicId`s with a write in flight: one mutation per person at a time. */
  readonly busy = signal<ReadonlySet<string>>(new Set());

  /** A reload after a successful write failed; the write itself stands. */
  readonly refreshFailed$ = this.refreshFailedEvents.asObservable();

  readonly totalCount = computed(() => this.rows().length);
  readonly openCount = computed(() => this.rows().filter(row => !row.contacted).length);
  readonly doneCount = computed(() => this.totalCount() - this.openCount());

  readonly visibleRows = computed<readonly LongAbsence[]>(() => {
    const filter = this.filter();
    if (filter === 'all') return this.rows();
    return this.rows().filter(row => row.contacted === (filter === 'done'));
  });

  constructor() {
    this.reads
      .pipe(
        switchMap(request =>
          request
            ? this.api.list().pipe(
                map(rows => ({ request, rows, error: null as unknown })),
                catchError((error: unknown) => of({ request, rows: null, error })),
              )
            : EMPTY,
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(({ request, rows, error }) => {
        if (rows) {
          this.rows.set(rows);
          this.status.set('ready');
        } else if (readApiError(error)?.status === 403) {
          this.revoke();
        } else if (request.quiet && this.status() === 'ready') {
          this.refreshFailedEvents.next();
        } else {
          this.rows.set([]);
          this.status.set('error');
        }
      });
  }

  load(): void {
    if (this.status() === 'forbidden') return;
    this.status.set('loading');
    this.reads.next({ quiet: false });
  }

  setFilter(filter: LongAbsentFilter): void {
    this.filter.set(filter);
  }

  isBusy(row: LongAbsence): boolean {
    return this.busy().has(row.memberPublicId);
  }

  setContacted(row: LongAbsence, contacted: boolean, memoUpdate?: LongAbsenceMemoUpdate): Observable<LongAbsentWriteResult> {
    const body: LongAbsenceContactStatusRequest = {
      lastSundayDate: row.lastSundayDate,
      version: row.version,
      contacted,
      ...(memoUpdate ? { memoUpdate } : {}),
    };
    return this.write(row, this.api.setContactStatus(row.memberPublicId, body));
  }

  /** `null` clears the memo on purpose. */
  setMemo(row: LongAbsence, memo: string | null): Observable<LongAbsentWriteResult> {
    return this.write(
      row,
      this.api.setMemo(row.memberPublicId, { lastSundayDate: row.lastSundayDate, version: row.version, memo }),
    );
  }

  /** 403: forget every person and memo and stop asking. */
  revoke(): void {
    this.reads.next(null);
    this.rows.set([]);
    this.busy.set(new Set());
    this.status.set('forbidden');
  }

  private write(row: LongAbsence, request: Observable<LongAbsence>): Observable<LongAbsentWriteResult> {
    const id = row.memberPublicId;
    if (this.busy().has(id) || this.status() === 'forbidden') return EMPTY;
    this.reads.next(null);
    this.setBusy(id, true);
    return request.pipe(
      map((saved): LongAbsentWriteResult => {
        this.rows.update(rows => rows.map(r => (r.memberPublicId === id ? saved : r)));
        this.reads.next({ quiet: true });
        return 'saved';
      }),
      catchError((error: unknown) => {
        const status = readApiError(error)?.status;
        if (status === 403) {
          this.revoke();
          return of<LongAbsentWriteResult>('forbidden');
        }
        if (status === 409 || status === 404) {
          this.reads.next({ quiet: true });
          return of<LongAbsentWriteResult>(status === 409 ? 'conflict' : 'notFound');
        }
        return of<LongAbsentWriteResult>('failed');
      }),
      finalize(() => this.setBusy(id, false)),
    );
  }

  private setBusy(id: string, busy: boolean): void {
    this.busy.update(current => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
