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

  /** An array value goes out as a repeated parameter (`k=a&k=b`). */
  get<T>(path: string, params?: Record<string, string | number | boolean | readonly string[]>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (Array.isArray(v)) {
          v.forEach(item => (httpParams = httpParams.append(k, item)));
        } else if (v !== undefined && v !== null) {
          httpParams = httpParams.set(k, String(v));
        }
      });
    }
    return this.unwrap(
      this.http.get<ApiResponse<T>>(`${this.base}${path}`, { params: httpParams })
    );
  }

  post<T>(path: string, body: unknown, headers?: Record<string, string>): Observable<T> {
    return this.unwrap(
      this.http.post<ApiResponse<T>>(`${this.base}${path}`, body, headers ? { headers } : {})
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

  /** DELETE that unwraps `ApiResponse<T>` — use when the server returns a body. */
  deleteData<T>(path: string): Observable<T> {
    return this.unwrap(
      this.http.delete<ApiResponse<T>>(`${this.base}${path}`),
    );
  }

  /** DELETE that answers either 204 without a body (`null`) or 200 with `ApiResponse<T>`. */
  deleteOptional<T>(path: string): Observable<T | null> {
    return this.http.delete<ApiResponse<T> | null>(`${this.base}${path}`).pipe(
      map(res => {
        if (res === null) return null;
        if (!res.success) throw new Error(res.message ?? 'API error');
        return res.data;
      }),
    );
  }
}
