import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import {
  AttendanceGroupCountsResponse,
  AttendanceLogResponse,
  CreateDefinitionRequest,
  DefinitionDto,
  UpdateDefinitionRequest,
} from './attendance.model';

@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly api = inject(ApiService);

  getDefinitions(activeOnly = false): Observable<DefinitionDto[]> {
    return this.api.get<DefinitionDto[]>('/v1/attendance/definitions', { active: activeOnly });
  }

  createDefinition(req: CreateDefinitionRequest): Observable<DefinitionDto> {
    return this.api.post<DefinitionDto>('/v1/attendance/definitions', req);
  }

  updateDefinition(publicId: string, req: UpdateDefinitionRequest): Observable<DefinitionDto> {
    return this.api.patch<DefinitionDto>(`/v1/attendance/definitions/${publicId}`, req);
  }

  deactivateDefinition(publicId: string): Observable<void> {
    return this.api.delete(`/v1/attendance/definitions/${publicId}`);
  }

  getGroupCounts(params: {
    definitionId: string;
    date: string;
  }): Observable<AttendanceGroupCountsResponse> {
    return this.api.get<AttendanceGroupCountsResponse>('/v1/attendance/group-counts', params);
  }

  /** The 체크인 명단, oldest check-in first. Without `definitionId` it covers the whole day. */
  getLogs(params: { date: string; definitionId?: string }): Observable<AttendanceLogResponse[]> {
    return this.api.get<AttendanceLogResponse[]>('/v1/attendance/logs', params);
  }
}
