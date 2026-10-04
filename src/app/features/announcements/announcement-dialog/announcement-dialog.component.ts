import { Component, DestroyRef, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';

import { injectAppLang } from '../../../core/i18n/language';
import { endOfDay, startOfDay } from '../../event-rsvps/event-rsvp-list/event-rsvp-dialog.component';
import { ANNOUNCEMENT_CATEGORIES, AnnouncementCategory, AnnouncementDto } from '../announcements.model';
import { AnnouncementsService } from '../announcements.service';

export const TITLE_MAX = 100;

/**
 * Figma: 공지 작성 (222:11617). One form for 추가 and 수정: 제목, 내용,
 * 카테고리 with 상단 고정 beside it, and the 게시 기간 as two dates.
 * 종료일 is optional — without it the 공지 stays up.
 */
@Component({
  selector: 'app-announcement-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    ButtonModule, CheckboxModule, DatePickerModule, DialogModule, InputTextModule, SelectModule, TextareaModule,
  ],
  templateUrl: './announcement-dialog.component.html',
})
export class AnnouncementDialogComponent {
  private readonly service    = inject(AnnouncementsService);
  private readonly translate  = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lang       = injectAppLang();

  /** Two-way: parent controls open/close via [(visible)]. */
  readonly visible = model(false);
  /** null opens 추가, an announcement opens 수정. */
  readonly announcement = input<AnnouncementDto | null>(null);

  readonly saved  = output<AnnouncementDto>();
  readonly failed = output<void>();

  readonly titleMax = TITLE_MAX;
  readonly saving = signal(false);

  readonly isEdit = computed(() => this.announcement() !== null);

  readonly dialogPt = {
    header: { style: { paddingBottom: 'var(--space-16)' } },
  };

  readonly form = inject(FormBuilder).group({
    title:    ['', [Validators.required, Validators.maxLength(TITLE_MAX)]],
    body:     ['', Validators.required],
    category: ['NOTICE' as AnnouncementCategory, Validators.required],
    isPinned: [false],
    startAt:  [null as Date | null, Validators.required],
    endAt:    [null as Date | null],
  }, { validators: endNotBeforeStart });

  readonly categoryOptions = computed(() => {
    this.lang();
    return ANNOUNCEMENT_CATEGORIES.map(value => ({
      value,
      label: this.translate.instant(`announcements.category.${value}`) as string,
    }));
  });

  constructor() {
    effect(() => {
      const a = this.announcement();
      this.visible();
      this.form.reset({
        title: a?.title ?? '',
        body: a?.body ?? '',
        category: a?.category ?? 'NOTICE',
        isPinned: a?.isPinned ?? false,
        startAt: a ? new Date(a.startAt) : null,
        endAt: a?.endAt ? new Date(a.endAt) : null,
      });
    });
  }

  endBeforeStart(): boolean { return this.form.hasError('endBeforeStart'); }

  hasError(control: 'title' | 'body' | 'startAt'): boolean {
    const c = this.form.controls[control];
    return c.hasError('required') && (c.touched || c.dirty);
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    const v = this.form.getRawValue();
    const fields = {
      title: v.title!.trim(),
      body: v.body!.trim(),
      category: v.category!,
      startAt: startOfDay(v.startAt!).toISOString(),
      endAt: v.endAt ? endOfDay(v.endAt).toISOString() : null,
      isPinned: v.isPinned ?? false,
    };

    const a = this.announcement();
    const request$: Observable<AnnouncementDto> = a
      ? this.service.updateAnnouncement(a.id, {
          ...fields,
          imageUrl: a.imageUrl ?? null,
          location: a.location ?? null,
        })
      : this.service.createAnnouncement(fields);

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

/** 종료일 may be the same day as 시작일, not earlier. */
function endNotBeforeStart(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startAt')?.value as Date | null;
  const end = group.get('endAt')?.value as Date | null;
  return start && end && startOfDay(end) < startOfDay(start) ? { endBeforeStart: true } : null;
}
