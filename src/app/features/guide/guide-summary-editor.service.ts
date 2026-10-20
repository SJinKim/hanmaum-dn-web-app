import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormBuilder, Validators } from '@angular/forms';
import { EMPTY, Subject, catchError, defer, finalize, of, switchMap, tap, throwError } from 'rxjs';
import { RoleService } from '../../core/services/role.service';
import { GuideReport, guideCountValidator, guideDateString, guideDateValue, parseGuideCount } from './guide-report.model';
import { GuideReportsApi } from './guide-reports-api.service';

@Injectable()
export class GuideSummaryEditorService {
  private readonly api = inject(GuideReportsApi);
  private readonly roles = inject(RoleService);
  private readonly destroy = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly requests = new Subject<string>();
  readonly source = signal<GuideReport | null>(null);
  readonly previous = signal<GuideReport | null>(null);
  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  readonly saving = signal(false);
  readonly previousFailed = signal(false);
  readonly previousLoading = signal(false);
  readonly failure = signal<'save' | 'conflict' | 'dateConflict' | 'notFound' | null>(null);
  readonly fieldErrors = signal<Readonly<Record<string, string>>>({});
  readonly form = this.fb.group({
    serviceDate: this.fb.control<Date | null>(null, [Validators.required,
      (c: AbstractControl) => guideDateString(c.value) === null ? { guideDate: true } : null]),
    service1Count: this.fb.nonNullable.control('', guideCountValidator),
    service2Count: this.fb.nonNullable.control('', guideCountValidator),
    service3Count: this.fb.nonNullable.control('', guideCountValidator),
    notes: this.fb.nonNullable.control(''),
  });
  private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  readonly totalPreview = computed(() => {
    this.values();
    const value = this.form.getRawValue();
    const counts = [value.service1Count, value.service2Count, value.service3Count].map(parseGuideCount);
    return counts.some(c => c === undefined || c === null) ? null : (counts as number[]).reduce((a, b) => a + b, 0);
  });
  readonly deltaPreview = computed(() => {
    const total = this.totalPreview(), previous = this.previous()?.totalCount;
    return this.previousLoading() || this.previousFailed() || total === null || previous == null ? null : total - previous;
  });

  constructor() {
    this.form.disable({ emitEvent: false });
    for (const name of ['serviceDate', 'service1Count', 'service2Count', 'service3Count', 'notes'] as const) {
      const control: AbstractControl = this.form.controls[name];
      control.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => {
        this.fieldErrors.update(fields => Object.fromEntries(Object.entries(fields).filter(([key]) => key !== name)));
        if (name === 'serviceDate' && this.failure() === 'dateConflict') this.failure.set(null);
      });
    }
    this.form.controls.serviceDate.valueChanges.pipe(switchMap(date => defer(() => {
      const iso = guideDateString(date);
      this.previous.set(null); this.previousFailed.set(false); this.previousLoading.set(true);
      return (iso ? this.api.previous(iso) : of(null)).pipe(
        catchError(() => { this.previousFailed.set(true); return of(null); }),
        finalize(() => this.previousLoading.set(false)),
      );
    })), takeUntilDestroyed(this.destroy)).subscribe(previous => this.previous.set(previous));
    this.requests.pipe(switchMap(id => defer(() => {
      this.loading.set(true); this.loadFailed.set(false); this.failure.set(null); this.fieldErrors.set({});
      this.source.set(null); this.previous.set(null); this.form.disable({ emitEvent: false });
      return this.api.get(id).pipe(
        tap(report => {
          this.source.set(report);
          if (report.reportMode !== 'SUMMARY_ONLY') return;
          this.form.reset({ serviceDate: guideDateValue(report.serviceDate), service1Count: report.service1Count?.toString() ?? '',
            service2Count: report.service2Count?.toString() ?? '', service3Count: report.service3Count?.toString() ?? '', notes: report.notes ?? '' });
          if (this.roles.canWrite('guide')) this.form.enable({ emitEvent: false });
        }),
        catchError((error: unknown) => { this.loadFailed.set(true); if (error instanceof HttpErrorResponse && error.status === 404) this.failure.set('notFound'); return EMPTY; }),
        finalize(() => this.loading.set(false)),
      );
    })), takeUntilDestroyed(this.destroy)).subscribe();
  }

  load(id: string): void { if (!this.saving()) this.requests.next(id); }
  fieldInvalid(name: string): boolean {
    const control = this.form.get(name);
    return !!(control?.touched && control.invalid) || !!this.fieldErrors()[name];
  }
  save() {
    this.form.markAllAsTouched();
    const source = this.source(), value = this.form.getRawValue();
    const date = guideDateString(value.serviceDate);
    const counts = [value.service1Count, value.service2Count, value.service3Count].map(parseGuideCount);
    if (!source || source.reportMode !== 'SUMMARY_ONLY' || !this.roles.canWrite('guide') || this.loading() || this.saving()
      || this.failure() === 'conflict' || this.failure() === 'notFound' || this.form.invalid || !date || counts.some(c => c === undefined)) return EMPTY;
    this.saving.set(true); this.failure.set(null); this.fieldErrors.set({}); this.form.disable({ emitEvent: false });
    return this.api.updateSummary(source.publicId, { serviceDate: date, service1Count: counts[0]!, service2Count: counts[1]!,
      service3Count: counts[2]!, notes: value.notes === '' ? null : value.notes, version: source.version }).pipe(
      tap(saved => { this.source.set(saved); this.form.markAsPristine(); this.saving.set(false); }),
      catchError((error: unknown) => {
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        const dateConflict = status === 409 && error instanceof HttpErrorResponse && error.error?.detail === 'An active report already exists for this date.';
        this.failure.set(dateConflict ? 'dateConflict' : status === 409 ? 'conflict' : status === 404 ? 'notFound' : 'save');
        if (dateConflict) this.fieldErrors.set({ serviceDate: 'conflict' });
        if (status === 400 && error instanceof HttpErrorResponse) {
          const fields: unknown = error.error?.data?.fieldErrors ?? error.error?.fieldErrors;
          if (fields && typeof fields === 'object' && !Array.isArray(fields)) this.fieldErrors.set(Object.fromEntries(Object.entries(fields).filter(([, v]) => typeof v === 'string')));
        }
        return throwError(() => error);
      }),
      finalize(() => { this.saving.set(false); this.form.enable({ emitEvent: false }); }),
    );
  }
}
