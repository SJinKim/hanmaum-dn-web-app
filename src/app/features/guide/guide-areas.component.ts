import { Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, merge } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { RoleService } from '../../core/services/role.service';
import { HasUnsavedChanges, UNSAVED_CHANGES_DIALOG_KEY } from '../../core/guards/unsaved-changes.guard';
import { GuideArea, parseGuideOrder } from './guide-area.model';
import { GuideAreaService } from './guide-area.service';

@Component({
  selector: 'app-guide-areas',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, TranslatePipe, ButtonModule, DialogModule,
    ConfirmDialogModule, InputTextModule, SelectModule],
  providers: [GuideAreaService],
  host: { class: 'block min-w-0' },
  templateUrl: './guide-areas.component.html',
})
export class GuideAreasComponent implements HasUnsavedChanges {
  readonly returnTo = inject(ActivatedRoute).snapshot.queryParamMap.get('returnTo') === '/guide/attendance/new' ? '/guide/attendance/new' : '/guide';
  readonly state = inject(GuideAreaService);
  private readonly roles = inject(RoleService);
  private readonly fb = inject(FormBuilder);
  private readonly confirmation = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);
  private readonly destroy = inject(DestroyRef);
  readonly canWrite = computed(() => this.roles.canWrite('guide'));
  readonly visible = signal(false);
  readonly unsavedChangesDialogKey = UNSAVED_CHANGES_DIALOG_KEY;
  readonly routeConfirming = signal(false);
  readonly navigationBlocked = signal(false);
  private readonly unavailableRoomLabel = toSignal(merge(this.translate.stream('guide.areas.unavailableRoom'), this.translate.getStreamOnTranslationChange('guide.areas.unavailableRoom')), { initialValue: '' });
  private confirming = false;
  readonly original = signal<GuideArea | null>(null);
  readonly activeCount = computed(() => this.state.areas().filter(a => a.active && this.state.roomIsEligible(a.roomPublicId)).length);
  readonly dialogPt = {
    header: { class: '!px-[var(--space-16)] tablet:!px-[var(--space-32)]' },
    content: { class: '!px-[var(--space-16)] tablet:!px-[var(--space-32)]' },
    footer: { class: '!px-[var(--space-16)] tablet:!px-[var(--space-32)]' },
  };
  readonly roomOptions = computed(() => {
    const options = this.state.rooms().map(r => ({ value: r.publicId, label: `${r.floorName} · ${r.name}` }));
    const old = this.original();
    if (old && !options.some(o => o.value === old.roomPublicId)) {
      options.push({ value: old.roomPublicId, label: `${old.roomName} (${this.unavailableRoomLabel()})` });
    }
    return options;
  });
  readonly form = this.fb.nonNullable.group({
    roomPublicId: ['', Validators.required],
    label: ['', [Validators.required, Validators.maxLength(200), Validators.pattern(/\S/)]],
    order: ['1', [Validators.required, (control: AbstractControl<string>) => parseGuideOrder(control.value) === null ? { integer: true } : null]],
    active: [true],
  });

  constructor() {
    for (const key of ['roomPublicId', 'label', 'order', 'active'] as const) {
      const control: AbstractControl = this.form.controls[key];
      control.valueChanges.pipe(takeUntilDestroyed(this.destroy))
        .subscribe(() => this.state.clearFieldError(key === 'order' ? 'displayOrder' : key));
    }
    this.state.load();
  }

  open(area: GuideArea | null = null): void {
    if (!this.canWrite() || this.state.saving() || this.state.loading() || this.state.loadFailed()) return;
    this.original.set(area);
    this.state.clearFailure();
    this.form.reset({ roomPublicId: area?.roomPublicId ?? '', label: area?.label ?? '',
      order: String(area ? area.displayOrder + 1 : Math.max(0, ...this.state.areas().map(a => a.displayOrder + 1)) + 1),
      active: area?.active ?? true });
    this.visible.set(true);
  }

  /** Missing rooms can only keep their old reference while deactivating. */
  invalidRoom(): boolean {
    const value = this.form.getRawValue();
    return !this.state.rooms().some(r => r.publicId === value.roomPublicId)
      && !(this.original()?.roomPublicId === value.roomPublicId && !value.active);
  }

  toggleActive(): void {
    if (this.state.saving()) return;
    this.form.controls.active.setValue(!this.form.controls.active.value);
    this.form.controls.active.markAsDirty();
  }

  submit(): void {
    if (!this.canWrite() || this.state.saving()) return;
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();
    const displayOrder = parseGuideOrder(value.order);
    if (this.form.invalid || this.invalidRoom() || displayOrder === null) return;
    this.navigationBlocked.set(false);
    this.form.disable({ emitEvent: false });
    this.state.save({ roomPublicId: value.roomPublicId, label: value.label.trim(), displayOrder, active: value.active }, this.original())
      .pipe(takeUntilDestroyed(this.destroy), finalize(() => { this.form.enable({ emitEvent: false }); this.navigationBlocked.set(false); })).subscribe({
        next: () => { this.form.markAsPristine(); this.visible.set(false); },
        error: () => { /* State owns field errors; keep every user-entered value. */ },
      });
  }

  close(): void {
    if (this.state.saving()) return;
    this.confirmDiscard(() => {
      const stale = this.state.failure() === 'conflict' || this.state.failure() === 'notFound';
      this.visible.set(false); this.form.markAsPristine();
      if (stale) this.state.load();
    });
  }

  reloadConflict(): void {
    if (this.state.saving()) return;
    this.confirmDiscard(() => { this.visible.set(false); this.form.markAsPristine(); this.state.load(); });
  }

  private confirmDiscard(action: () => void): void {
    if (!this.hasUnsavedChanges()) { action(); return; }
    if (this.confirming) return;
    this.confirming = true;
    this.confirmation.confirm({ key: 'guide-discard', header: this.translate.instant('guide.areas.discardTitle'),
      message: this.translate.instant('guide.areas.discardMessage'),
      icon: 'pi pi-exclamation-triangle', acceptButtonStyleClass: 'p-button-danger',
      acceptLabel: this.translate.instant('guide.areas.discard'), rejectLabel: this.translate.instant('common.unsavedChanges.stay'),
      accept: () => { this.confirming = false; action(); }, reject: () => { this.confirming = false; } });
  }

  fieldError(name: string): boolean {
    const control = this.form.get(name);
    return !!(control?.touched && control.invalid) || !!this.state.fieldErrors()[name === 'order' ? 'displayOrder' : name];
  }

  hasUnsavedChanges(): boolean { return this.state.saving() || (this.visible() && this.form.dirty); }

  @HostListener('document:keydown.escape', ['$event'])
  escape(event: Event): void {
    if (this.visible() && !this.confirming && !this.routeConfirming() && !event.defaultPrevented) this.close();
  }

  roomCaption(area: GuideArea): string {
    const room = this.state.rooms().find(r => r.publicId === area.roomPublicId);
    return room ? `${room.floorName} · ${room.name}` : area.roomName;
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) { event.preventDefault(); event.returnValue = ''; }
  }
}
