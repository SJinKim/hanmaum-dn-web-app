import { Component, DestroyRef, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, of, startWith, switchMap } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';

import { injectAppLang } from '../../../core/i18n/language';
import { EventRsvpDto, EventRsvpStatus, eventRsvpStatus } from '../event-rsvp.model';
import { EventRsvpService } from '../event-rsvp.service';

export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 500;

/**
 * Figma: 새 이벤트 추가 (282:18570). One form for 추가 and 수정: 이벤트명,
 * 설명, 상태 with 바로 공개 beside it, and the 접수 기간 as two dates.
 *
 * 상태 is not a field of its own on the server — it follows from 바로 공개
 * (`isActive`) and the dates, so the select only shows the result.
 * The linked 공지 is not in the form; editing keeps whatever link exists.
 */
@Component({
  selector: 'app-event-rsvp-dialog',
  standalone: true,
  imports: [
    FormsModule, ReactiveFormsModule, TranslatePipe,
    ButtonModule, CheckboxModule, DatePickerModule, DialogModule, InputTextModule, SelectModule, TextareaModule,
  ],
  templateUrl: './event-rsvp-dialog.component.html',
})
export class EventRsvpDialogComponent {
  private readonly service    = inject(EventRsvpService);
  private readonly translate  = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lang       = injectAppLang();

  /** Two-way: parent controls open/close via [(visible)]. */
  readonly visible = model(false);
  /** null opens 추가, an event opens 수정. */
  readonly rsvp = input<EventRsvpDto | null>(null);

  readonly saved  = output<EventRsvpDto>();
  readonly failed = output<void>();

  readonly titleMax = TITLE_MAX;
  readonly descriptionMax = DESCRIPTION_MAX;
  readonly saving = signal(false);

  readonly isEdit = computed(() => this.rsvp() !== null);

  /** Figma Dialog/Medium: 24 panel padding, 16 between title, subtitle, form and footer. */
  readonly dialogPt = {
    header: { style: { paddingBottom: 'var(--space-16)' } },
  };

  readonly form = inject(FormBuilder).group({
    title:       ['', [Validators.required, Validators.maxLength(TITLE_MAX)]],
    description: ['', Validators.maxLength(DESCRIPTION_MAX)],
    isActive:    [true],
    windowStart: [null as Date | null, Validators.required],
    windowEnd:   [null as Date | null, Validators.required],
  }, { validators: endNotBeforeStart });

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  /** What 상태 will read once saved; `null` until both dates are set. */
  readonly derivedStatus = computed<EventRsvpStatus | null>(() => {
    const v = this.formValue();
    if (!v.windowStart || !v.windowEnd) return v.isActive === false ? 'INACTIVE' : null;
    return eventRsvpStatus({
      publicId: '', title: '', announcementPublicId: null,
      isActive: v.isActive ?? true,
      windowStart: startOfDay(v.windowStart).toISOString(),
      windowEnd: endOfDay(v.windowEnd).toISOString(),
    });
  });

  readonly statusOptions = computed(() => {
    this.lang();
    return (['OPEN', 'SCHEDULED', 'CLOSED', 'INACTIVE'] as const).map(value => ({
      value,
      label: this.translate.instant(`events.status.${value}`) as string,
    }));
  });

  constructor() {
    effect(() => {
      const r = this.rsvp();
      this.visible();
      this.form.reset({
        title: r?.title ?? '',
        description: r?.description ?? '',
        isActive: r?.isActive ?? true,
        windowStart: r ? new Date(r.windowStart) : null,
        windowEnd: r ? new Date(r.windowEnd) : null,
      });
    });
  }

  endBeforeStart(): boolean { return this.form.hasError('endBeforeStart'); }

  hasError(control: 'title' | 'windowStart' | 'windowEnd'): boolean {
    const c = this.form.controls[control];
    return c.hasError('required') && (c.touched || c.dirty);
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    const v = this.form.getRawValue();
    const title = v.title!.trim();
    const description = v.description?.trim() ?? '';
    const isActive = v.isActive ?? true;
    const windowStart = startOfDay(v.windowStart!).toISOString();
    const windowEnd = endOfDay(v.windowEnd!).toISOString();

    const r = this.rsvp();
    const request$: Observable<EventRsvpDto> = r
      ? this.service.updateRsvp(r.publicId, { title, description, isActive, windowStart, windowEnd })
      : this.service
          .createRsvp({ title, description: description || null, isActive, windowStart, windowEnd })
          // A server without #226 ignores `isActive` and opens every new event.
          .pipe(switchMap(created => created.isActive === isActive
            ? of(created)
            : this.service.updateRsvp(created.publicId, { isActive })));

    this.saving.set(true);
    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: saved => {
          this.saving.set(false);
          this.saved.emit(saved);
          this.close();
        },
        error: () => {
          this.saving.set(false);
          this.failed.emit();
        },
      });
  }

  close(): void { this.visible.set(false); }
}

/** 접수 시작 opens at the start of its day. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 접수 종료 closes at the end of its day. */
export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 0);
  return d;
}

/** 접수 종료 may be the same day as 접수 시작, not earlier. */
function endNotBeforeStart(group: AbstractControl): ValidationErrors | null {
  const start = group.get('windowStart')?.value as Date | null;
  const end = group.get('windowEnd')?.value as Date | null;
  return start && end && startOfDay(end) < startOfDay(start) ? { endBeforeStart: true } : null;
}
