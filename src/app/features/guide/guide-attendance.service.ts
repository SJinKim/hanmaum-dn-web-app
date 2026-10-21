import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormBuilder, Validators } from '@angular/forms';
import { EMPTY, Subject, catchError, defer, finalize, forkJoin, map, switchMap, tap, throwError } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { RoleService } from '../../core/services/role.service';
import { GuideArea, GuideRoom } from './guide-area.model';
import { GuideCountField, GuideDetailEntry, GuideDetails, GuideServiceNumber, GuideSnapshotArea, guideEntryTotal, guideSum } from './guide-details.model';
import { GuideDetailsApi } from './guide-details-api.service';
import { guideCountValidator, guideDateString, guideDateValue, parseGuideCount } from './guide-report.model';

function entryGroup(fb: FormBuilder, entry: GuideDetailEntry) {
  return fb.nonNullable.group({ areaPublicId: entry.areaPublicId, serviceNumber: entry.serviceNumber,
    adultCount: [entry.adultCount?.toString() ?? '', guideCountValidator],
    schoolCount: [entry.schoolCount?.toString() ?? '', guideCountValidator],
    youthCount: [entry.youthCount?.toString() ?? '', guideCountValidator] });
}
type GuidePreviewEntry = Omit<GuideDetailEntry, GuideCountField> & Partial<Record<GuideCountField, number | null>>;
interface GuideDraft { dirty: boolean; date: Date | null; notes: string; areas: GuideSnapshotArea[]; entries: ReturnType<ReturnType<typeof entryGroup>['getRawValue']>[] }
@Injectable({ providedIn: 'root' })
export class GuideAttendanceDraft { value: GuideDraft | null = null; }

@Injectable()
export class GuideAttendanceService {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(GuideDetailsApi);
  private readonly http = inject(ApiService);
  private readonly roles = inject(RoleService);
  private readonly destroy = inject(DestroyRef);
  private readonly draft = inject(GuideAttendanceDraft);
  private readonly requests = new Subject<{ id: string | null; configurationOnly: boolean }>();
  readonly areas = signal<GuideSnapshotArea[]>([]);
  readonly removedAreas = signal<GuideSnapshotArea[]>([]);
  private eligible: GuideSnapshotArea[] = [];
  readonly source = signal<GuideDetails | null>(null);
  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  readonly saving = signal(false);
  readonly configurationChanged = signal(false);
  readonly failure = signal<'save' | 'conflict' | 'dateConflict' | 'notFound' | 'configuration' | null>(null);
  readonly fieldErrors = signal<Readonly<Record<string, string>>>({});
  readonly form = this.fb.group({
    serviceDate: this.fb.control<Date | null>(null, [Validators.required,
      (c: AbstractControl) => guideDateString(c.value) ? null : { guideDate: true }]),
    notes: this.fb.nonNullable.control(''),
    entries: this.fb.array<ReturnType<typeof entryGroup>>([]),
  });
  private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  readonly previews = computed(() => {
    this.values();
    return this.form.controls.entries.getRawValue().map(row => ({ areaPublicId: row.areaPublicId, serviceNumber: row.serviceNumber,
      adultCount: parseGuideCount(row.adultCount), schoolCount: parseGuideCount(row.schoolCount),
      youthCount: row.serviceNumber === 3 ? parseGuideCount(row.youthCount) : null }));
  });
  readonly overflow = computed(() => ([1, 2, 3] as const).some(service =>
    this.previews().filter(e => e.serviceNumber === service).reduce((sum, e) => sum + (e.adultCount ?? 0) + (e.schoolCount ?? 0) + (e.youthCount ?? 0), 0) > 2147483647));

  constructor() {
    this.form.disable({ emitEvent: false });
    this.form.controls.serviceDate.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => {
      this.clearField('serviceDate'); if (this.failure() === 'dateConflict') this.failure.set(null);
    });
    this.form.controls.notes.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => this.clearField('notes'));
    this.requests.pipe(switchMap(request => defer(() => {
      this.loading.set(true); this.loadFailed.set(false); this.failure.set(null); this.fieldErrors.set({});
      this.form.disable({ emitEvent: false });
      const response = request.id
        ? this.api.get(request.id).pipe(tap(details => {
          if (details.report.reportMode !== 'DETAILED') throw new Error('Detailed report required');
          this.source.set(details); this.areas.set(this.sorted(details.rooms)); this.removedAreas.set([]);
          const entries = this.areas().flatMap(area => ([1, 2, 3] as const).map(serviceNumber => {
            const counts = details.entries.find(e => e.areaPublicId === area.areaPublicId && e.serviceNumber === serviceNumber)?.counts;
            if (!counts) throw new Error('Incomplete detail snapshot');
            return { areaPublicId: area.areaPublicId, serviceNumber, adultCount: counts.adultCount, schoolCount: counts.schoolCount,
              youthCount: serviceNumber === 3 ? counts.youthCount : null };
          }));
          this.setRows(entries); this.form.controls.serviceDate.setValue(guideDateValue(details.report.serviceDate));
          this.form.controls.notes.setValue(details.report.notes ?? ''); this.form.markAsPristine();
        }), map(() => undefined))
        : forkJoin({ areas: this.http.get<GuideArea[]>('/v1/guide/counting-areas'), rooms: this.http.get<GuideRoom[]>('/v1/guide/counting-areas/rooms') }).pipe(tap(data => {
          this.source.set(null); this.eligible = this.sorted(data.areas.filter(a => a.active && data.rooms.some(r => r.publicId === a.roomPublicId)));
          const previousAreas = this.areas(), oldRows = this.form.controls.entries.getRawValue();
          const removed = previousAreas.filter(a => !this.eligible.some(e => e.areaPublicId === a.areaPublicId)
            && oldRows.some(e => e.areaPublicId === a.areaPublicId && [e.adultCount, e.schoolCount, e.youthCount].some(v => v !== '')));
          this.removedAreas.set(removed); this.areas.set([...this.eligible, ...removed]);
          this.configurationChanged.set(request.configurationOnly && JSON.stringify(previousAreas) !== JSON.stringify(this.areas()));
          this.setRows(this.areas().flatMap(a => ([1, 2, 3] as const).map(serviceNumber => {
            const old = oldRows.find(e => e.areaPublicId === a.areaPublicId && e.serviceNumber === serviceNumber);
            return { areaPublicId: a.areaPublicId, serviceNumber, adultCount: old ? parseGuideCount(old.adultCount) : null,
              schoolCount: old ? parseGuideCount(old.schoolCount) : null, youthCount: serviceNumber === 3 && old ? parseGuideCount(old.youthCount) : null };
          })), oldRows);
        }), map(() => undefined));
      return response.pipe(catchError((error: unknown) => {
        this.loadFailed.set(true); if (error instanceof HttpErrorResponse && error.status === 404) this.failure.set('notFound'); return EMPTY;
      }), finalize(() => { this.loading.set(false); if (!this.loadFailed() && this.roles.canWrite('guide')) this.form.enable({ emitEvent: false }); }));
    })), takeUntilDestroyed(this.destroy)).subscribe();
  }
  load(id: string | null): void {
    if (this.saving()) return;
    if (!id && !this.areas().length && this.draft.value) {
      const draft = this.draft.value; this.draft.value = null; this.areas.set(draft.areas);
      this.form.controls.serviceDate.setValue(draft.date); this.form.controls.notes.setValue(draft.notes);
      this.setRows([], draft.entries); if (draft.dirty) this.form.markAsDirty();
    }
    this.requests.next({ id, configurationOnly: !id && this.areas().length > 0 });
  }
  keepDraft(): void {
    const value = this.form.getRawValue();
    this.draft.value = { dirty: this.form.dirty, date: value.serviceDate, notes: value.notes, areas: this.areas(), entries: value.entries };
  }
  discardRemoved(): void {
    if (this.saving() || this.loading() || this.source()) return;
    const rows = this.form.controls.entries.getRawValue().filter(e => this.eligible.some(a => a.areaPublicId === e.areaPublicId));
    this.areas.set(this.eligible); this.setRows([], rows); this.removedAreas.set([]); this.form.markAsDirty();
  }
  private sorted<T extends GuideSnapshotArea>(areas: T[]): T[] { return [...areas].sort((a, b) => a.displayOrder - b.displayOrder || a.areaPublicId.localeCompare(b.areaPublicId)); }
  private setRows(entries: GuidePreviewEntry[], raw?: GuideDraft['entries']): void {
    const controls = this.form.controls.entries; controls.clear({ emitEvent: false });
    const rows = entries.length ? entries : raw ?? [];
    for (const entry of rows) {
      const old = raw?.find(e => e.areaPublicId === entry.areaPublicId && e.serviceNumber === entry.serviceNumber);
      const group = entryGroup(this.fb, { areaPublicId: entry.areaPublicId, serviceNumber: entry.serviceNumber, adultCount: null, schoolCount: null, youthCount: null });
      group.patchValue({ adultCount: old?.adultCount ?? entry.adultCount?.toString() ?? '', schoolCount: old?.schoolCount ?? entry.schoolCount?.toString() ?? '', youthCount: old?.youthCount ?? entry.youthCount?.toString() ?? '' }, { emitEvent: false });
      controls.push(group, { emitEvent: false });
    }
    controls.updateValueAndValidity();
  }
  clearField(field: string): void { this.fieldErrors.update(errors => Object.fromEntries(Object.entries(errors).filter(([key]) => key !== field))); }
  rowIndex(area: string, service: GuideServiceNumber): number { return this.form.controls.entries.controls.findIndex(c => c.controls.areaPublicId.value === area && c.controls.serviceNumber.value === service); }
  rowTotal(area: string, service: GuideServiceNumber): number | null {
    const entry = this.previews().find(e => e.areaPublicId === area && e.serviceNumber === service);
    return entry ? guideEntryTotal(entry as GuideDetailEntry) : null;
  }
  sum(field: GuideCountField | 'totalCount' | 'compatibleAdultCount', area?: string, service?: GuideServiceNumber): number | null {
    const entries = this.previews().filter(e => (!area || e.areaPublicId === area) && (!service || e.serviceNumber === service) && (field !== 'youthCount' || e.serviceNumber === 3));
    return guideSum(entries.map(e => field === 'totalCount' ? guideEntryTotal(e as GuideDetailEntry)
      : field === 'compatibleAdultCount' ? guideSum([e.adultCount, ...(e.serviceNumber === 3 ? [e.youthCount] : [])]) : e[field]));
  }
  fieldInvalid(field: string): boolean { const c = this.form.get(field); return !!(c?.touched && c.invalid) || !!this.fieldErrors()[field]; }
  save() {
    this.form.markAllAsTouched(); const value = this.form.getRawValue(), serviceDate = guideDateString(value.serviceDate);
    if (!this.roles.canWrite('guide') || this.loading() || this.loadFailed() || this.saving() || this.form.invalid || !serviceDate
      || !this.areas().length || this.removedAreas().length || this.overflow() || this.failure() === 'conflict' || this.failure() === 'notFound') return EMPTY;
    const entries = value.entries.map(e => ({ areaPublicId: e.areaPublicId, serviceNumber: e.serviceNumber,
      adultCount: parseGuideCount(e.adultCount) as number | null, schoolCount: parseGuideCount(e.schoolCount) as number | null,
      youthCount: e.serviceNumber === 3 ? parseGuideCount(e.youthCount) as number | null : null }));
    const request = { serviceDate, notes: value.notes === '' ? null : value.notes, entries };
    const source = this.source(); this.saving.set(true); this.failure.set(null); this.fieldErrors.set({}); this.form.disable({ emitEvent: false });
    return (source ? this.api.update(source.report.publicId, request, source.report.version) : this.api.create(request)).pipe(
      tap(saved => { this.source.set(saved); this.draft.value = null; this.form.markAsPristine(); this.saving.set(false); }),
      catchError((error: unknown) => {
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        const duplicate = status === 409 && error instanceof HttpErrorResponse && error.error?.detail === 'An active report already exists for this date.';
        const fields: unknown = error instanceof HttpErrorResponse ? error.error?.data?.fieldErrors ?? error.error?.fieldErrors : null;
        if (fields && typeof fields === 'object' && !Array.isArray(fields)) this.fieldErrors.set(Object.fromEntries(Object.entries(fields).filter(([, v]) => typeof v === 'string').map(([key, value]) => [key.replace(/\[(\d+)\]/g, '.$1'), value])));
        if (duplicate) this.fieldErrors.update(errors => ({ ...errors, serviceDate: 'conflict' }));
        this.failure.set(duplicate ? 'dateConflict' : status === 409 ? 'conflict' : status === 404 ? 'notFound' : status === 400 && !source ? 'configuration' : 'save');
        return throwError(() => error);
      }), finalize(() => { this.saving.set(false); this.form.enable({ emitEvent: false }); }),
    );
  }
}
