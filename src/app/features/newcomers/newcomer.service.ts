import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, catchError, of, switchMap, tap } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { PageResponse } from '../../core/models/api-response.model';
import {
  CreateNewcomerRequest,
  GraduateNewcomerRequest,
  Newcomer,
  NewcomerGraduation,
  NewcomerIdentityStatus,
  NewcomerLifecycleStatus,
  NewcomerOptions,
  NewcomerSortProperty,
  PostAssignmentAttendance,
  UpdateNewcomerRequest,
} from '../../core/models/newcomer.model';

/** One column in one direction — sent as `sort=<property>&direction=<direction>`. */
export interface NewcomerSort {
  readonly property: NewcomerSortProperty;
  readonly direction: 'asc' | 'desc';
}

/** The server's own default: newest registration first. */
const DEFAULT_SORT: NewcomerSort = { property: 'registrationDate', direction: 'desc' };

/** ISO date of this week's Monday — the start of 이번 주 신규 (#41). */
export function mondayOf(today: Date): string {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

@Injectable({ providedIn: 'root' })
export class NewcomerService {
  private readonly api = inject(ApiService);

  // ── 새가족-Listen-State (#41) ──────────────────────────────────────────────
  // Wie bei 청년 liegt der State im Service: er überlebt den Wechsel ins Detail
  // und zurück, und Anlegen, Bearbeiten und 등반 laden dieselbe Liste neu.

  readonly search     = signal('');
  readonly attendance = signal<PostAssignmentAttendance | null>(null);
  /** A caregiver `publicId` from `GET /newcomers/options`. */
  readonly caregiver  = signal<string | null>(null);
  readonly identity   = signal<NewcomerIdentityStatus | null>(null);
  readonly sort       = signal<NewcomerSort>(DEFAULT_SORT);
  readonly page       = signal(0);
  readonly size       = signal(20);

  readonly newcomers   = signal<readonly Newcomer[]>([]);
  readonly total       = signal(0);
  readonly listLoading = signal(true);
  readonly listFailed  = signal(false);

  /** Header subtitle counts, independent of the list's filters. */
  readonly inCareCount      = signal(0);
  readonly graduatedCount   = signal(0);
  readonly newThisWeekCount = signal(0);

  private readonly reload$ = new Subject<void>();

  constructor() {
    this.reload$
      .pipe(
        tap(() => {
          this.listLoading.set(true);
          this.listFailed.set(false);
        }),
        switchMap(() =>
          this.getNewcomers({
            search:     this.search(),
            attendance: this.attendance(),
            caregiver:  this.caregiver(),
            identity:   this.identity(),
            sort:       this.sort(),
            page:       this.page(),
            size:       this.size(),
          }).pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(res => {
        if (res) {
          this.newcomers.set(res.content);
          this.total.set(res.totalElements);
        } else {
          this.newcomers.set([]);
          this.total.set(0);
          this.listFailed.set(true);
        }
        this.listLoading.set(false);
      });
  }

  loadNewcomers(): void {
    this.reload$.next();
  }

  setSearch(value: string): void {
    this.search.set(value);
    this.page.set(0);
    this.loadNewcomers();
  }

  setAttendance(value: PostAssignmentAttendance | null): void {
    this.attendance.set(value);
    this.page.set(0);
    this.loadNewcomers();
  }

  setCaregiver(value: string | null): void {
    this.caregiver.set(value);
    this.page.set(0);
    this.loadNewcomers();
  }

  setIdentity(value: NewcomerIdentityStatus | null): void {
    this.identity.set(value);
    this.page.set(0);
    this.loadNewcomers();
  }

  /** A new column starts ascending, the current one flips direction. */
  toggleSort(property: NewcomerSortProperty): void {
    const current = this.sort();
    const direction = current.property === property && current.direction === 'asc' ? 'desc' : 'asc';
    this.sort.set({ property, direction });
    this.page.set(0);
    this.loadNewcomers();
  }

  setPage(value: number): void {
    if (value < 0) return;
    this.page.set(value);
    this.loadNewcomers();
  }

  resetFilters(): void {
    this.search.set('');
    this.attendance.set(null);
    this.caregiver.set(null);
    this.identity.set(null);
    this.page.set(0);
    this.loadNewcomers();
  }

  /**
   * 등반 대기 · 배정 완료 · 이번 주 신규 — three `size=1` reads of `totalElements`,
   * so the numbers come from the server and not from the current page.
   */
  refreshCounts(today: Date = new Date()): void {
    this.getNewcomers({ lifecycleStatus: 'IN_CARE', size: 1 }).subscribe({
      next: res => this.inCareCount.set(res.totalElements),
    });
    this.getNewcomers({ lifecycleStatus: 'GRADUATED', size: 1 }).subscribe({
      next: res => this.graduatedCount.set(res.totalElements),
    });
    this.getNewcomers({ registeredFrom: mondayOf(today), size: 1 }).subscribe({
      next: res => this.newThisWeekCount.set(res.totalElements),
    });
  }

  /** Every filter is a query parameter of `NewcomerController.list`; nothing is filtered client-side. */
  getNewcomers(params: {
    search?: string;
    attendance?: PostAssignmentAttendance | null;
    caregiver?: string | null;
    identity?: NewcomerIdentityStatus | null;
    lifecycleStatus?: NewcomerLifecycleStatus | null;
    registeredFrom?: string | null;
    sort?: NewcomerSort | null;
    page?: number;
    size?: number;
  }): Observable<PageResponse<Newcomer>> {
    const qp: Record<string, string | number | boolean | readonly string[]> = {
      page: params.page ?? 0,
      size: params.size ?? 20,
    };
    if (params.search?.trim())  qp['search']            = params.search.trim();
    if (params.attendance)      qp['attendance']        = params.attendance;
    if (params.caregiver)       qp['caregiverPublicId'] = params.caregiver;
    if (params.identity)        qp['identityStatus']    = params.identity;
    if (params.lifecycleStatus) qp['lifecycleStatus']   = params.lifecycleStatus;
    if (params.registeredFrom)  qp['registeredFrom']    = params.registeredFrom;
    if (params.sort) {
      qp['sort']      = params.sort.property;
      qp['direction'] = params.sort.direction;
    }
    return this.api.get<PageResponse<Newcomer>>('/v1/newcomers', qp);
  }

  getNewcomer(publicId: string): Observable<Newcomer> {
    return this.api.get<Newcomer>(`/v1/newcomers/${publicId}`);
  }

  createNewcomer(req: CreateNewcomerRequest): Observable<Newcomer> {
    return this.api.post<Newcomer>('/v1/newcomers', req);
  }

  updateNewcomer(publicId: string, req: UpdateNewcomerRequest): Observable<Newcomer> {
    return this.api.patch<Newcomer>(`/v1/newcomers/${publicId}`, req);
  }

  deleteNewcomer(publicId: string): Observable<void> {
    return this.api.delete(`/v1/newcomers/${publicId}`);
  }

  /** Caregivers and 순 for the selects, plus the enum values the server accepts. */
  getOptions(): Observable<NewcomerOptions> {
    return this.api.get<NewcomerOptions>('/v1/newcomers/options');
  }

  /** 등반: the newcomer becomes a member of the chosen 순 (#43). */
  graduate(publicId: string, req: GraduateNewcomerRequest): Observable<NewcomerGraduation> {
    return this.api.post<NewcomerGraduation>(`/v1/newcomers/${publicId}/graduate`, req);
  }
}
