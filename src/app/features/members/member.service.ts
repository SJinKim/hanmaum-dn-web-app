import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
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

  /** Refetches the pending count. Safe to call from anywhere after a state change. */
  refreshPendingCount(): void {
    this.getMembers({ status: 'PENDING', size: 1 }).subscribe({
      next: res => this.pendingCount.set(res.totalElements),
    });
  }

  getMembers(params: {
    search?: string;
    status?: MemberStatus | null;
    role?: 'ADMIN' | 'MEMBER' | null;
    baptism?: Baptism | null;
    page?: number;
    size?: number;
    sort?: string;
  }): Observable<PageResponse<MemberSummary>> {
    const qp: Record<string, string | number | boolean> = {
      page: params.page ?? 0,
      size: params.size ?? 20,
    };
    if (params.search?.trim()) qp['search']  = params.search.trim();
    if (params.status)         qp['status']  = params.status;
    if (params.role)           qp['role']    = params.role;
    if (params.baptism)        qp['baptism'] = params.baptism;
    if (params.sort)           qp['sort']    = params.sort;
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
