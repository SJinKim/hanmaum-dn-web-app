import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import {
  Ministry,
  MinistrySummary,
  ActiveMinistryMemberDto,
  CreateMinistryRequest,
  UpdateMinistryRequest,
  MemberNameDto,
  AddMinistryMemberRequest,
} from './ministry.model';

@Injectable({ providedIn: 'root' })
export class MinistryService {
  private readonly api = inject(ApiService);

  getMinistries(active?: boolean | null): Observable<MinistrySummary[]> {
    const params: Record<string, string | number | boolean> = {};
    if (active !== null && active !== undefined) params['active'] = active;
    return this.api.get<MinistrySummary[]>('/v1/ministries', params);
  }

  getMinistry(publicId: string): Observable<Ministry> {
    return this.api.get<Ministry>(`/v1/ministries/${publicId}`);
  }

  createMinistry(req: CreateMinistryRequest): Observable<Ministry> {
    return this.api.post<Ministry>('/v1/ministries', req);
  }

  updateMinistry(publicId: string, req: UpdateMinistryRequest): Observable<Ministry> {
    return this.api.patch<Ministry>(`/v1/ministries/${publicId}`, req);
  }

  deactivateMinistry(publicId: string): Observable<void> {
    return this.api.delete(`/v1/ministries/${publicId}`);
  }

  getActiveMembers(publicId: string): Observable<ActiveMinistryMemberDto[]> {
    return this.api.get<ActiveMinistryMemberDto[]>(`/v1/ministries/${publicId}/members`);
  }

  /** Lightweight 맴버 name list for the add-member picker. Admin or ministry-leader. */
  getMemberNames(): Observable<MemberNameDto[]> {
    return this.api.get<MemberNameDto[]>('/v1/members/names');
  }

  /** Adds an existing 맴버 to this ministry. Backend appends + dedupes (409 if already active). */
  addMember(
    ministryPublicId: string,
    body: AddMinistryMemberRequest,
  ): Observable<ActiveMinistryMemberDto> {
    return this.api.post<ActiveMinistryMemberDto>(
      `/v1/ministries/${ministryPublicId}/members`,
      body,
    );
  }
}
