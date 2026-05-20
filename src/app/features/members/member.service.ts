import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { PageResponse } from '../../core/models/api-response.model';
import {
  Member,
  MemberSummary,
  MemberStatus,
  Baptism,
  CreateMemberRequest,
  UpdateMemberRequest,
} from '../../core/models/member.model';

@Injectable({ providedIn: 'root' })
export class MemberService {
  private readonly api = inject(ApiService);

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

  approveMember(publicId: string): Observable<Member> {
    return this.api.patch<Member>(`/v1/members/${publicId}`, { memberStatus: 'ACTIVE' });
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
}
