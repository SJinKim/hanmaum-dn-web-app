import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ApiResponse } from '../models/api-response.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /** Unwraps ApiResponse<T>, throwing if success=false */
  private unwrap<T>(obs: Observable<ApiResponse<T>>): Observable<T> {
    return obs.pipe(
      map(res => {
        if (!res.success || res.data === null) {
          throw new Error(res.message ?? 'API error');
        }
        return res.data;
      })
    );
  }

  get<T>(path: string, params?: Record<string, string | number | boolean>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          httpParams = httpParams.set(k, String(v));
        }
      });
    }
    return this.unwrap(
      this.http.get<ApiResponse<T>>(`${this.base}${path}`, { params: httpParams })
    );
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.unwrap(
      this.http.post<ApiResponse<T>>(`${this.base}${path}`, body)
    );
  }

  postForm<T>(path: string, body: FormData): Observable<T> {
    return this.unwrap(
      this.http.post<ApiResponse<T>>(`${this.base}${path}`, body)
    );
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.unwrap(
      this.http.put<ApiResponse<T>>(`${this.base}${path}`, body)
    );
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.unwrap(
      this.http.patch<ApiResponse<T>>(`${this.base}${path}`, body)
    );
  }

  delete(path: string): Observable<void> {
    return this.http.delete<void>(`${this.base}${path}`);
  }
}
