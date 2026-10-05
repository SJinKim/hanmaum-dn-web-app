import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { PageResponse } from '../../core/models/api-response.model';
import {
  Reconciliation,
  ReconciliationStatus,
  ResolveReconciliationRequest,
} from '../../core/models/reconciliation.model';
import { ApiService } from '../../core/services/api.service';

/** 계정 연결 확인 (#45). Nothing is linked until a 새가족팀 member picks a candidate. */
@Injectable({ providedIn: 'root' })
export class ReconciliationService {
  private readonly api = inject(ApiService);
  private readonly base = '/v1/newcomers/reconciliations';

  list(status: ReconciliationStatus, page = 0, size = 20): Observable<PageResponse<Reconciliation>> {
    return this.api.get<PageResponse<Reconciliation>>(this.base, { status, page, size });
  }

  get(publicId: string): Observable<Reconciliation> {
    return this.api.get<Reconciliation>(`${this.base}/${publicId}`);
  }

  link(publicId: string, body: ResolveReconciliationRequest): Observable<Reconciliation> {
    return this.api.post<Reconciliation>(`${this.base}/${publicId}/link`, body);
  }

  /** Like `link`, for when both members already have 새가족 history. */
  merge(publicId: string, body: ResolveReconciliationRequest): Observable<Reconciliation> {
    return this.api.post<Reconciliation>(`${this.base}/${publicId}/merge`, body);
  }

  dismiss(publicId: string, version: number): Observable<Reconciliation> {
    return this.api.post<Reconciliation>(`${this.base}/${publicId}/dismiss`, { version });
  }
}
