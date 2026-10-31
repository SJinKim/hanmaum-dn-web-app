import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  LONG_ABSENCE_PAGE_SIZE,
  LongAbsence,
  LongAbsenceChange,
  LongAbsenceContactStatusRequest,
  LongAbsenceHistoryItem,
  LongAbsenceMemoRequest,
  LongAbsencePage,
  LongAbsencePhase,
  LongAbsenceReturn,
  LongAbsenceReturnRequest,
  LongAbsenceSummary,
} from '../models/long-absent.model';
import { ApiService } from './api.service';

const BASE = '/v1/attendance/long-absences';

/**
 * 장기결석자 (#277, #279). Stateless: Home and 통계 each hold their own state, so
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

  /** 다시 출석 (#279): ends the current phase without a check-in. */
  markReturned(memberPublicId: string, body: LongAbsenceReturnRequest): Observable<LongAbsenceReturn> {
    return this.api.put<LongAbsenceReturn>(`${BASE}/${encodeURIComponent(memberPublicId)}/return`, body);
  }

  /** Closed phases, newest end first; no memos. Optionally of one member. */
  history(page: number, memberPublicId?: string, size = LONG_ABSENCE_PAGE_SIZE): Observable<LongAbsencePage<LongAbsenceHistoryItem>> {
    return this.api.get<LongAbsencePage<LongAbsenceHistoryItem>>(`${BASE}/history`, {
      page,
      size,
      ...(memberPublicId ? { memberPublicId } : {}),
    });
  }

  phase(memberPublicId: string, phasePublicId: string): Observable<LongAbsencePhase> {
    return this.api.get<LongAbsencePhase>(
      `${BASE}/${encodeURIComponent(memberPublicId)}/phases/${encodeURIComponent(phasePublicId)}`,
    );
  }

  /** Contact and memo changes of one phase, newest first. */
  changes(
    memberPublicId: string,
    phasePublicId: string,
    page: number,
    size = LONG_ABSENCE_PAGE_SIZE,
  ): Observable<LongAbsencePage<LongAbsenceChange>> {
    return this.api.get<LongAbsencePage<LongAbsenceChange>>(
      `${BASE}/${encodeURIComponent(memberPublicId)}/phases/${encodeURIComponent(phasePublicId)}/changes`,
      { page, size },
    );
  }
}
