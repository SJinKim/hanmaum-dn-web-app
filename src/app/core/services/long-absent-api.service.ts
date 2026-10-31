import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  LongAbsence,
  LongAbsenceContactStatusRequest,
  LongAbsenceMemoRequest,
  LongAbsenceSummary,
} from '../models/long-absent.model';
import { ApiService } from './api.service';

const BASE = '/v1/attendance/long-absences';

/**
 * 장기결석자 (#277). Stateless: Home and 통계 each hold their own state, so
 * neither feature imports the other. Only `pastor` / `admin` may call these.
 */
@Injectable({ providedIn: 'root' })
export class LongAbsentApi {
  private readonly api = inject(ApiService);

  /** The full current list, sorted by the server; `[]` when nobody qualifies. */
  list(): Observable<LongAbsence[]> {
    return this.api.get<LongAbsence[]>(BASE);
  }

  /** Counts without names or memos — all Home and the tab counter may load. */
  summary(): Observable<LongAbsenceSummary> {
    return this.api.get<LongAbsenceSummary>(`${BASE}/summary`);
  }

  setContactStatus(memberPublicId: string, body: LongAbsenceContactStatusRequest): Observable<LongAbsence> {
    return this.api.put<LongAbsence>(`${BASE}/${encodeURIComponent(memberPublicId)}/contact-status`, body);
  }

  setMemo(memberPublicId: string, body: LongAbsenceMemoRequest): Observable<LongAbsence> {
    return this.api.put<LongAbsence>(`${BASE}/${encodeURIComponent(memberPublicId)}/memo`, body);
  }
}
