import { Injectable, inject } from '@angular/core';
import { throwError } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { RoleService } from '../../core/services/role.service';
import { GuideDetails, GuideDetailsRequest } from './guide-details.model';
@Injectable({ providedIn: 'root' })
export class GuideDetailsApi {
  private readonly api = inject(ApiService);
  private readonly roles = inject(RoleService);
  private readonly path = '/v1/guide/worship-counts';
  get(id: string) { return this.api.get<GuideDetails>(`${this.path}/${encodeURIComponent(id)}/details`); }
  create(request: GuideDetailsRequest) {
    return this.roles.canWrite('guide') ? this.api.post<GuideDetails>(`${this.path}/details`, request)
      : throwError(() => new Error('Guide write unavailable'));
  }
  update(id: string, request: GuideDetailsRequest, version: number) {
    return this.roles.canWrite('guide') ? this.api.put<GuideDetails>(`${this.path}/${encodeURIComponent(id)}/details`, { ...request, version })
      : throwError(() => new Error('Guide write unavailable'));
  }
}
