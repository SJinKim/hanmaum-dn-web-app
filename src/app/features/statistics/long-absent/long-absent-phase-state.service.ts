import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, catchError, map, of, switchMap } from 'rxjs';
import { readApiError } from '../../../core/http/api-error';
import { LongAbsenceChange, LongAbsencePage, LongAbsencePhase } from '../../../core/models/long-absent.model';
import { LongAbsentApi } from '../../../core/services/long-absent-api.service';

/** Which phase the 이력 panel shows. `fullName` titles it while the detail loads. */
export interface LongAbsentPhaseTarget {
  readonly memberPublicId: string;
  readonly phasePublicId: string;
  readonly fullName: string;
}

export type LongAbsentPhaseStatus = 'closed' | 'loading' | 'ready' | 'error' | 'notFound' | 'forbidden';
export type LongAbsentChangesStatus = 'loading' | 'ready' | 'error';

type Read<T> = { value: T } | { error: unknown };

function settle<T>(source: Observable<T>): Observable<Read<T>> {
  return source.pipe(
    map((value): Read<T> => ({ value })),
    catchError((error: unknown) => of<Read<T>>({ error })),
  );
}

/**
 * The 이력 panel (#279 AK 3, 4): one phase with its current memo and its paged
 * contact and memo changes. Detail and changes load independently, so a failed
 * change page is a partial failure next to a readable detail. Every text lives
 * only while the panel is open; reopening or a write on the same person reads
 * fresh from the server and never rebuilds a deleted memo from what was loaded.
 */
@Injectable()
export class LongAbsentPhaseState {
  private readonly api = inject(LongAbsentApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly details = new Subject<LongAbsentPhaseTarget | null>();
  private readonly changePages = new Subject<{ target: LongAbsentPhaseTarget; page: number } | null>();

  readonly target = signal<LongAbsentPhaseTarget | null>(null);
  readonly status = signal<LongAbsentPhaseStatus>('closed');
  readonly phase = signal<LongAbsencePhase | null>(null);

  readonly changes = signal<readonly LongAbsenceChange[]>([]);
  readonly changesStatus = signal<LongAbsentChangesStatus>('loading');
  private readonly lastChangePage = signal<LongAbsencePage<LongAbsenceChange> | null>(null);
  readonly totalChanges = computed(() => this.lastChangePage()?.totalElements ?? 0);
  readonly hasMoreChanges = computed(() => {
    const last = this.lastChangePage();
    return !!last && last.page + 1 < last.totalPages;
  });

  /** A 403 here also ends the page's access; the page listens and revokes the rest. */
  private readonly forbiddenEvents = new Subject<void>();
  readonly forbidden$ = this.forbiddenEvents.asObservable();

  constructor() {
    this.details
      .pipe(
        switchMap(target => (target ? settle(this.api.phase(target.memberPublicId, target.phasePublicId)) : EMPTY)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(read => {
        if ('value' in read) {
          this.phase.set(read.value);
          this.status.set('ready');
          return;
        }
        const status = readApiError(read.error)?.status;
        if (status === 403) this.revoke();
        else this.status.set(status === 404 ? 'notFound' : 'error');
      });

    this.changePages
      .pipe(
        switchMap(request =>
          request
            ? settle(this.api.changes(request.target.memberPublicId, request.target.phasePublicId, request.page))
            : EMPTY,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(read => {
        if ('value' in read) {
          const page = read.value;
          const seen = new Set(page.page === 0 ? [] : this.changes().map(change => change.publicId));
          const base = page.page === 0 ? [] : this.changes();
          this.changes.set([...base, ...page.items.filter(change => !seen.has(change.publicId))]);
          this.lastChangePage.set(page);
          this.changesStatus.set('ready');
          return;
        }
        if (readApiError(read.error)?.status === 403) this.revoke();
        else this.changesStatus.set('error');
      });
  }

  isOpen(): boolean {
    return this.target() !== null;
  }

  open(target: LongAbsentPhaseTarget): void {
    if (this.status() === 'forbidden') return;
    this.target.set(target);
    this.read(target);
  }

  retry(): void {
    const target = this.target();
    if (target) this.read(target);
  }

  retryChanges(): void {
    const target = this.target();
    if (!target) return;
    const last = this.lastChangePage();
    this.changesStatus.set('loading');
    this.changePages.next({ target, page: this.changes().length && last ? last.page + 1 : 0 });
  }

  loadMoreChanges(): void {
    const target = this.target();
    const last = this.lastChangePage();
    if (!target || !last || !this.hasMoreChanges() || this.changesStatus() === 'loading') return;
    this.changesStatus.set('loading');
    this.changePages.next({ target, page: last.page + 1 });
  }

  /**
   * A write on this person changed the phase (memo, contact, 복귀): drop every
   * loaded text and read again, so a deleted memo cannot survive in the panel.
   */
  refreshFor(memberPublicId: string): void {
    const target = this.target();
    if (target?.memberPublicId === memberPublicId && this.status() !== 'forbidden') this.read(target);
  }

  close(): void {
    this.details.next(null);
    this.changePages.next(null);
    this.target.set(null);
    this.clear();
    if (this.status() !== 'forbidden') this.status.set('closed');
  }

  revoke(): void {
    const wasForbidden = this.status() === 'forbidden';
    this.details.next(null);
    this.changePages.next(null);
    this.target.set(null);
    this.clear();
    this.status.set('forbidden');
    if (!wasForbidden) this.forbiddenEvents.next();
  }

  private read(target: LongAbsentPhaseTarget): void {
    this.clear();
    this.status.set('loading');
    this.changesStatus.set('loading');
    this.details.next(target);
    this.changePages.next({ target, page: 0 });
  }

  private clear(): void {
    this.phase.set(null);
    this.changes.set([]);
    this.lastChangePage.set(null);
  }
}
