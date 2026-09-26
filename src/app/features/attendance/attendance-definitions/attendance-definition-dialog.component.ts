import { Component, DestroyRef, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';

import { injectAppLang } from '../../../core/i18n/language';
import { AttendanceService } from '../attendance.service';
import { DAY_OF_WEEK_OPTIONS, DayOfWeek, DefinitionDto } from '../attendance.model';

export const TITLE_MAX = 100;
export const DESCRIPTION_MAX = 500;

/**
 * Figma: 출석 정의 추가 (279:18000). One form for 추가 and 수정: 제목, 설명,
 * 요일 with 활성 beside it, and the check-in window 체크인 시작 – 체크인 종료.
 */
@Component({
  selector: 'app-attendance-definition-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    ButtonModule, CheckboxModule, DialogModule, InputTextModule, SelectModule, TextareaModule,
  ],
  templateUrl: './attendance-definition-dialog.component.html',
})
export class AttendanceDefinitionDialogComponent {
  private readonly service    = inject(AttendanceService);
  private readonly translate  = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lang       = injectAppLang();

  /** Two-way: parent controls open/close via [(visible)]. */
  readonly visible = model(false);
  /** null opens 추가, a definition opens 수정. */
  readonly definition = input<DefinitionDto | null>(null);

  readonly saved  = output<DefinitionDto>();
  readonly failed = output<void>();

  readonly titleMax = TITLE_MAX;
  readonly descriptionMax = DESCRIPTION_MAX;
  readonly saving = signal(false);

  readonly isEdit = computed(() => this.definition() !== null);

  readonly dayOptions = computed(() => {
    this.lang();
    return DAY_OF_WEEK_OPTIONS.map(o => ({
      value: o.value,
      label: this.translate.instant(`attendance.days.${o.value}`) as string,
    }));
  });

  /** Figma Dialog/Medium: 24 panel padding, 16 between title, subtitle, form and footer. */
  readonly dialogPt = {
    header: { style: { paddingBottom: 'var(--space-16)' } },
  };

  readonly form = inject(FormBuilder).group({
    title:       ['', [Validators.required, Validators.maxLength(TITLE_MAX)]],
    description: ['', Validators.maxLength(DESCRIPTION_MAX)],
    dayOfWeek:   [null as DayOfWeek | null, Validators.required],
    isActive:    [true],
    windowStart: ['', Validators.required],
    windowEnd:   ['', Validators.required],
  }, { validators: endAfterStart });

  constructor() {
    effect(() => {
      const d = this.definition();
      this.visible();
      this.form.reset({
        title: d?.title ?? '',
        description: d?.description ?? '',
        dayOfWeek: d?.dayOfWeek ?? null,
        isActive: d?.isActive ?? true,
        windowStart: d ? hhmm(d.windowStart) : '',
        windowEnd: d ? hhmm(d.windowEnd) : '',
      });
    });
  }

  endNotAfterStart(): boolean { return this.form.hasError('endNotAfterStart'); }

  hasError(control: 'title' | 'dayOfWeek' | 'windowStart' | 'windowEnd'): boolean {
    const c = this.form.controls[control];
    return c.hasError('required') && (c.touched || c.dirty);
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    const v = this.form.getRawValue();
    const body = {
      title: v.title!.trim(),
      description: v.description?.trim() ?? '',
      dayOfWeek: v.dayOfWeek!,
      windowStart: hhmmss(v.windowStart!),
      windowEnd: hhmmss(v.windowEnd!),
      isActive: v.isActive ?? true,
    };
    const d = this.definition();
    const request$ = d
      ? this.service.updateDefinition(d.publicId, body)
      : this.service.createDefinition({ ...body, description: body.description || null });

    this.saving.set(true);
    request$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: def => {
          this.saving.set(false);
          this.saved.emit(def);
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

/** "09:00:00" → "09:00" for `<input type="time">`. */
function hhmm(time: string): string { return time.slice(0, 5); }

/** "09:00" → "09:00:00", the LocalTime the server expects. */
function hhmmss(time: string): string { return time.length === 5 ? `${time}:00` : time; }

/** 체크인 종료 must come after 체크인 시작; "HH:mm" compares as text. */
function endAfterStart(group: AbstractControl): ValidationErrors | null {
  const start = group.get('windowStart')?.value as string;
  const end = group.get('windowEnd')?.value as string;
  return start && end && end <= start ? { endNotAfterStart: true } : null;
}
