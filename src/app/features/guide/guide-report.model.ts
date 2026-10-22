import { AbstractControl, ValidationErrors } from '@angular/forms';

export type GuideReportMode = 'SUMMARY_ONLY' | 'DETAILED';
export interface GuideReport {
  publicId: string;
  serviceDate: string;
  service1Count: number | null;
  service2Count: number | null;
  service3Count: number | null;
  totalCount: number | null;
  previousWeekDelta: number | null;
  notes: string | null;
  version: number;
  reportMode: GuideReportMode;
  complete: boolean;
}
export interface GuideSummaryRequest {
  serviceDate: string;
  service1Count: number | null;
  service2Count: number | null;
  service3Count: number | null;
  notes: string | null;
  version: number;
}
export interface GuideReportQuery {
  from?: string;
  to?: string;
  page?: number;
  size?: number;
  sort?: 'serviceDate,asc' | 'serviceDate,desc';
}

/** Empty is unknown. Invalid text never becomes zero, a rounded number, or NaN. */
export function parseGuideCount(value: unknown): number | null | undefined {
  if (value === '') return null;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return undefined;
  const count = Number(value);
  return Number.isSafeInteger(count) && count <= 2147483647 ? count : undefined;
}
export function guideCountValidator(control: AbstractControl): ValidationErrors | null {
  return parseGuideCount(control.value) === undefined ? { guideCount: true } : null;
}
export function guideDateString(value: unknown): string | null {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime()) || value.getFullYear() < 1 || value.getFullYear() > 9999) return null;
  return `${String(value.getFullYear()).padStart(4, '0')}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
export function guideDateValue(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day); date.setHours(12, 0, 0, 0);
  return date;
}
export function guidePreviousWeek(value: string): string | null {
  const date = guideDateValue(value); date.setDate(date.getDate() - 7);
  return guideDateString(date);
}
export function guideYear(): number {
  return Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Berlin' }).format(new Date()));
}
