import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import {
  CreateEventRsvpRequest,
  EventRsvpAttendeesResponse,
  EventRsvpDto,
  UpdateEventRsvpRequest,
} from './event-rsvp.model';

@Injectable({ providedIn: 'root' })
export class EventRsvpService {
  private readonly api = inject(ApiService);
  private readonly basePath = '/v1/events/rsvps';

  getRsvps(): Observable<EventRsvpDto[]> {
    return this.api.get<EventRsvpDto[]>(this.basePath);
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
