export interface ApiResponse<T> {
  success: boolean;
  message: string | null;
  data: T | null;
}

/** Spring Page response shape */
export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;   // current page (0-based)
  size: number;
}

/** `ErrorResponse` — the body of a failed request, in `HttpErrorResponse.error`. */
export interface ApiErrorResponse<D = unknown> {
  status: number;
  error: string;
  message: string;
  code?: string;
  fieldErrors?: Record<string, string>;
  /** Only on `ATTENDANCE_WINDOW_OVERLAP`. */
  conflictingDefinition?: D;
}
