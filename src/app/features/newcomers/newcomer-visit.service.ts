import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import {
  CreateNewcomerVisitRequest,
  NewcomerVisit,
  NewcomerVisitStats,
  UpdateNewcomerVisitRequest,
} from '../../core/models/newcomer-visit.model';

/** An inclusive date range; the server defaults both ends to today and caps it at 365 days. */
export interface VisitRange {
  readonly from: string;
  readonly to: string;
}

/** 방문 기록 (#40) — `NewcomerVisitController` of hanmaum-dn-server #262. */
@Injectable({ providedIn: 'root' })
export class NewcomerVisitService {
  private readonly api = inject(ApiService);

  getVisits(range: VisitRange): Observable<NewcomerVisit[]> {
    return this.api.get<NewcomerVisit[]>('/v1/newcomers/visits', { from: range.from, to: range.to });
  }

  getStats(range: VisitRange): Observable<NewcomerVisitStats> {
    return this.api.get<NewcomerVisitStats>('/v1/newcomers/visits/stats', { from: range.from, to: range.to });
  }

  createVisit(req: CreateNewcomerVisitRequest): Observable<NewcomerVisit> {
    return this.api.post<NewcomerVisit>('/v1/newcomers/visits', req);
  }

  updateVisit(publicId: string, req: UpdateNewcomerVisitRequest): Observable<NewcomerVisit> {
    return this.api.patch<NewcomerVisit>(`/v1/newcomers/visits/${publicId}`, req);
  }

  deleteVisit(publicId: string): Observable<void> {
    return this.api.delete(`/v1/newcomers/visits/${publicId}`);
  }

  /** Links the visit to a 새가족 profile; `null` removes the link. */
  linkProfile(publicId: string, newcomerPublicId: string | null): Observable<NewcomerVisit> {
    return this.api.put<NewcomerVisit>(`/v1/newcomers/visits/${publicId}/profile`, { newcomerPublicId });
  }
}
