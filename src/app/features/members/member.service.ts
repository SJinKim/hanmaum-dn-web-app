import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, catchError, of, switchMap, tap } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { TrainingCatalogService } from '../../core/services/training-catalog.service';
import { PageResponse } from '../../core/models/api-response.model';
import {
  Member,
  MemberSummary,
  MemberStatus,
  Baptism,
  CreateMemberRequest,
  UpdateMemberRequest,
  ChurchGroupSummary,
} from '../../core/models/member.model';
import {
  TrainingCatalogEntry,
  MemberTrainingItem,
  MinistryCatalogEntry,
  MemberMinistryItem,
} from '../../core/models/member-activity.model';

@Injectable({ providedIn: 'root' })
export class MemberService {
  private readonly api             = inject(ApiService);
  private readonly trainingCatalog = inject(TrainingCatalogService);

  /** Shared, real-time count of members in PENDING status. */
  readonly pendingCount = signal(0);

  // ── 청년-Listen-State (#53) ────────────────────────────────────────────────
  // Filter, Seite und Ergebnis liegen im Service, nicht in der Liste: der
  // Deep-Link aus Home (`/members?status=PENDING`) und der Approve-Flow
  // schreiben denselben State, und er überlebt so einen Komponenten-Neuaufbau.

  readonly search  = signal('');
  readonly status  = signal<MemberStatus | null>(null);
  readonly baptism = signal<Baptism | null>(null);
  readonly page    = signal(0);
  readonly size    = signal(20);

  readonly members     = signal<readonly MemberSummary[]>([]);
  readonly total       = signal(0);
  readonly listLoading = signal(true);
  /** True when the last list request failed — the list shows an error state. */
  readonly listFailed  = signal(false);

  /** Every load goes through here, so `switchMap` cancels the outdated request. */
  private readonly reload$ = new Subject<void>();

  constructor() {
    this.reload$
      .pipe(
        tap(() => {
          this.listLoading.set(true);
          this.listFailed.set(false);
        }),
        switchMap(() =>
          this.getMembers({
            search:  this.search(),
            status:  this.status(),
            baptism: this.baptism(),
            page:    this.page(),
            size:    this.size(),
          }).pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(res => {
        if (res) {
          this.members.set(res.content);
          this.total.set(res.totalElements);
        } else {
          this.members.set([]);
          this.total.set(0);
          this.listFailed.set(true);
        }
        this.listLoading.set(false);
      });
  }

  /** Fetches the current page for the current filters. */
  loadMembers(): void {
    this.reload$.next();
  }

  // A filter change always returns to page 0 — page 3 of the old result set says
  // nothing about the new one. A page change leaves the filters standing (#53).
  setSearch(value: string): void {
    this.search.set(value);
    this.page.set(0);
    this.loadMembers();
  }

  setStatus(value: MemberStatus | null): void {
    this.status.set(value);
    this.page.set(0);
    this.loadMembers();
  }

  setBaptism(value: Baptism | null): void {
    this.baptism.set(value);
    this.page.set(0);
    this.loadMembers();
  }

  setPage(value: number): void {
    if (value < 0) return;
    this.page.set(value);
    this.loadMembers();
  }

  resetFilters(): void {
    this.search.set('');
    this.status.set(null);
    this.baptism.set(null);
    this.page.set(0);
    this.loadMembers();
  }

  /** Refetches the pending count. Safe to call from anywhere after a state change. */
  refreshPendingCount(): void {
    this.getMembers({ status: 'PENDING', size: 1 }).subscribe({
      next: res => this.pendingCount.set(res.totalElements),
    });
  }

  /**
   * `MemberController.listMembers` knows exactly these five parameters. `role`
   * and `sort` were sent before and silently ignored — the list only appeared to
   * filter and sort by them because it loaded everything at once and did the
   * work in the client. Filtering by 순/양육/사역 and any sort beyond
   * `lastName ASC` need server support: hanmaum-dn-server#196.
   */
  getMembers(params: {
    search?: string;
    status?: MemberStatus | null;
    baptism?: Baptism | null;
    page?: number;
    size?: number;
  }): Observable<PageResponse<MemberSummary>> {
    const qp: Record<string, string | number | boolean> = {
      page: params.page ?? 0,
      size: params.size ?? 20,
    };
    if (params.search?.trim()) qp['search']  = params.search.trim();
    if (params.status)         qp['status']  = params.status;
    if (params.baptism)        qp['baptism'] = params.baptism;
    return this.api.get<PageResponse<MemberSummary>>('/v1/members', qp);
  }

  /** Approves a pending member and assigns their church group in one atomic PATCH. */
  approveMember(publicId: string, groupPublicId: string): Observable<Member> {
    return this.api.patch<Member>(`/v1/members/${publicId}`, {
      memberStatus: 'ACTIVE',
      groupPublicId,
    });
  }

  getMember(publicId: string): Observable<Member> {
    return this.api.get<Member>(`/v1/members/${publicId}`);
  }

  createMember(req: CreateMemberRequest): Observable<Member> {
    return this.api.post<Member>('/v1/members', req);
  }

  updateMember(publicId: string, req: UpdateMemberRequest): Observable<Member> {
    return this.api.patch<Member>(`/v1/members/${publicId}`, req);
  }

  deleteMember(publicId: string): Observable<void> {
    return this.api.delete(`/v1/members/${publicId}`);
  }

  /** All church groups — populates the "Church Group" select in the member edit form. */
  getChurchGroups(): Observable<ChurchGroupSummary[]> {
    return this.api.get<ChurchGroupSummary[]>('/v1/church-groups');
  }

  /** Makes the member the group's current 순장, closing any sitting tenure. */
  assignGroupLeader(groupPublicId: string, memberPublicId: string): Observable<ChurchGroupSummary> {
    return this.api.put<ChurchGroupSummary>(`/v1/church-groups/${groupPublicId}/leader`, {
      memberPublicId,
    });
  }

  /** Ends the group's current 순장 tenure. Idempotent when the group is already vacant. */
  clearGroupLeader(groupPublicId: string): Observable<ChurchGroupSummary> {
    return this.api.deleteData<ChurchGroupSummary>(`/v1/church-groups/${groupPublicId}/leader`);
  }

  /**
   * The admin training catalog, including retired courses. Delegates to
   * {@link TrainingCatalogService} so the whole app shares one fetch and one cache.
   */
  getTrainingCatalog(): Observable<TrainingCatalogEntry[]> {
    return this.trainingCatalog.load();
  }

  /** Replaces the member's entire training set; returns the refreshed member detail. */
  replaceMemberTrainings(publicId: string, trainings: MemberTrainingItem[]): Observable<Member> {
    return this.api.put<Member>(`/v1/members/${publicId}/trainings`, { trainings });
  }

  /** Ministry options for the member edit form (active ministries only). */
  getMinistryCatalog(): Observable<MinistryCatalogEntry[]> {
    return this.api.get<MinistryCatalogEntry[]>('/v1/ministries', { active: true });
  }

  /** Replaces the member's entire ministry assignment set; returns refreshed detail. */
  replaceMemberMinistries(publicId: string, ministries: MemberMinistryItem[]): Observable<Member> {
    return this.api.put<Member>(`/v1/members/${publicId}/ministries`, { ministries });
  }
}
