import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import {
  CreateEventRsvpRequest,
  EventAnnouncementOption,
  EventRsvpAttendeesResponse,
  EventRsvpDto,
  UpdateEventRsvpRequest,
} from './event-rsvp.model';

interface AdminAnnouncement {
  id: string;
  title: string;
  category: string;
}

@Injectable({ providedIn: 'root' })
export class EventRsvpService {
  private readonly api = inject(ApiService);
  private readonly basePath = '/v1/events/rsvps';

  getRsvps(): Observable<EventRsvpDto[]> {
    return this.api.get<EventRsvpDto[]>(this.basePath);
  }

  getEventAnnouncements(): Observable<EventAnnouncementOption[]> {
    return this.api.get<AdminAnnouncement[]>('/v1/announcements/admin').pipe(
      map(announcements =>
        announcements
          .filter(announcement => announcement.category === 'EVENT')
          .map(({ id, title }) => ({ id, title })),
      ),
    );
  }

  createRsvp(request: CreateEventRsvpRequest): Observable<EventRsvpDto> {
    return this.api.post<EventRsvpDto>(this.basePath, request);
  }

  updateRsvp(publicId: string, request: UpdateEventRsvpRequest): Observable<EventRsvpDto> {
    return this.api.patch<EventRsvpDto>(`${this.basePath}/${publicId}`, request);
  }

  deactivateRsvp(publicId: string): Observable<void> {
    return this.api.delete(`${this.basePath}/${publicId}`);
  }

  getAttendees(publicId: string): Observable<EventRsvpAttendeesResponse> {
    return this.api.get<EventRsvpAttendeesResponse>(`${this.basePath}/${publicId}/attendees`);
  }
}
