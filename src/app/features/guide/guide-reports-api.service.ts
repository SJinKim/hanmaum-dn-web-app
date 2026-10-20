import { Injectable, inject } from '@angular/core';
import { Observable, map, of, throwError } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { RoleService } from '../../core/services/role.service';
import { PageResponse } from '../../core/models/api-response.model';
import { GuideReport, GuideReportQuery, GuideSummaryRequest, guidePreviousWeek } from './guide-report.model';

@Injectable({ providedIn: 'root' })
export class GuideReportsApi {
  private readonly api = inject(ApiService);
  private readonly roles = inject(RoleService);
  private readonly path = '/v1/guide/worship-counts';

  list(query: GuideReportQuery = {}) {
    return this.api.get<PageResponse<GuideReport>>(this.path, { page: 0, size: 6, sort: 'serviceDate,desc', ...query });
  }
  get(publicId: string) { return this.api.get<GuideReport>(`${this.path}/${encodeURIComponent(publicId)}`); }
  previous(serviceDate: string): Observable<GuideReport | null> {
    const previous = guidePreviousWeek(serviceDate);
    return previous ? this.list({ from: previous, to: previous, page: 0, size: 1 }).pipe(map(page => page.content[0] ?? null)) : of(null);
  }
  updateSummary(publicId: string, request: GuideSummaryRequest) {
    if (!this.roles.canWrite('guide')) return throwError(() => new Error('Guide write unavailable'));
    return this.api.patch<GuideReport>(`${this.path}/${encodeURIComponent(publicId)}`, request);
  }
  remove(report: GuideReport) {
    if (!this.roles.canWrite('guide')) return throwError(() => new Error('Guide write unavailable'));
    return this.api.delete(`${this.path}/${encodeURIComponent(report.publicId)}?version=${encodeURIComponent(report.version)}`);
  }
}
