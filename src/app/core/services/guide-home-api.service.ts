import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { GuideHomeSnapshot } from '../models/guide-home.model';

@Injectable({ providedIn: 'root' })
export class GuideHomeApi {
  private readonly api = inject(ApiService);
  get() { return this.api.get<GuideHomeSnapshot>('/v1/guide/worship-counts/home'); }
}
