import { Component, DestroyRef, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';

import { BulletinService } from '../bulletins.model';
import { BulletinsService } from '../bulletins.service';

export const SERVICE_NAME_MAX = 100;

/**
 * 예배 추가 / 수정 (#194): 이름, 시작 시간, 활성 and 주보 기본. Every service is a
 * Sunday service, so there is no 요일 field.
 */
@Component({
  selector: 'app-bulletin-service-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, ButtonModule, CheckboxModule, DialogModule, InputTextModule],
  templateUrl: './bulletin-service-dialog.component.html',
})
export class BulletinServiceDialogComponent {
  private readonly service    = inject(BulletinsService);
  private readonly destroyRef = inject(DestroyRef);

  /** Two-way: parent controls open/close via [(visible)]. */
  readonly visible = model(false);
  /** null opens 추가, a service opens 수정. */
  readonly bulletinService = input<BulletinService | null>(null);
  /** sortOrder a new service gets: after the last one. */
  readonly nextSortOrder = input(0);

  readonly saved  = output<BulletinService>();
  readonly failed = output<void>();

  readonly nameMax = SERVICE_NAME_MAX;
  readonly saving = signal(false);
  readonly isEdit = computed(() => this.bulletinService() !== null);

  readonly dialogPt = {
    header: { style: { paddingBottom: 'var(--space-16)' } },
  };

  readonly form = inject(FormBuilder).group({
    name:              ['', [Validators.required, Validators.maxLength(SERVICE_NAME_MAX)]],
    startTime:         ['', Validators.required],
    active:            [true],
    isBulletinDefault: [false],
  });

  constructor() {
    effect(() => {
      const s = this.bulletinService();
      this.visible();
      untracked(() => this.form.reset({
        name: s?.name ?? '',
        startTime: s ? hhmm(s.startTime) : '',
        active: s?.active ?? true,
        isBulletinDefault: s?.isBulletinDefault ?? false,
      }));
    });
  }

  hasError(control: 'name' | 'startTime'): boolean {
    const c = this.form.controls[control];
    return c.hasError('required') && (c.touched || c.dirty);
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    const v = this.form.getRawValue();
    const s = this.bulletinService();
    const body = {
      name: v.name!.trim(),
      startTime: hhmmss(v.startTime!),
      sortOrder: s?.sortOrder ?? this.nextSortOrder(),
      active: v.active ?? true,
      isBulletinDefault: v.isBulletinDefault ?? false,
    };
    const request$ = s ? this.service.updateService(s.publicId, body) : this.service.createService(body);

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

/** "09:00:00" → "09:00" for `<input type="time">`. */
export function hhmm(time: string): string { return time.slice(0, 5); }

/** "09:00" → "09:00:00", the LocalTime the server expects. */
function hhmmss(time: string): string { return time.length === 5 ? `${time}:00` : time; }
