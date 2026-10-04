import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { DashboardStats } from './statistics.model';

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private readonly api = inject(ApiService);

  getDashboard(): Observable<DashboardStats> {
    return this.api.get<DashboardStats>('/v1/statistics/dashboard');
  }
}
