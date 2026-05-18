import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import {
  AnnouncementDto,
  CreateAnnouncementRequest,
  UpdateAnnouncementRequest,
} from './announcements.model';

@Injectable({ providedIn: 'root' })
export class AnnouncementsService {
  private readonly api = inject(ApiService);

  getAnnouncements(): Observable<AnnouncementDto[]> {
    return this.api.get<AnnouncementDto[]>('/v1/announcements/admin');
  }

  createAnnouncement(req: CreateAnnouncementRequest): Observable<AnnouncementDto> {
    return this.api.post<AnnouncementDto>('/v1/announcements', req);
  }

  updateAnnouncement(id: string, req: UpdateAnnouncementRequest): Observable<AnnouncementDto> {
    return this.api.put<AnnouncementDto>(`/v1/announcements/${id}`, req);
  }

  deleteAnnouncement(id: string): Observable<void> {
    return this.api.delete(`/v1/announcements/${id}`);
  }
}
