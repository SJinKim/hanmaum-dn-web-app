import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import {
  Ministry,
  MinistrySummary,
  ActiveMinistryMemberDto,
  CreateMinistryRequest,
  UpdateMinistryRequest,
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
}
