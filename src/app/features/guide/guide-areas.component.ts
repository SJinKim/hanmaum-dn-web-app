import { Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, merge } from 'rxjs';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DragDropModule } from 'primeng/dragdrop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { RoleService } from '../../core/services/role.service';
import { HasUnsavedChanges, UNSAVED_CHANGES_DIALOG_KEY } from '../../core/guards/unsaved-changes.guard';
import { GuideArea } from './guide-area.model';
import { GuideAreaService } from './guide-area.service';
import { GuideAttendanceDraft } from './guide-attendance.service';

@Component({
  selector: 'app-guide-areas',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, TranslatePipe, ButtonModule, DialogModule,
    ConfirmDialogModule, InputTextModule, SelectModule, DragDropModule],
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
  private readonly router = inject(Router);
  private readonly draft = inject(GuideAttendanceDraft);
  readonly canWrite = computed(() => this.roles.canWrite('guide'));
  readonly visible = signal(false);
  readonly unsavedChangesDialogKey = UNSAVED_CHANGES_DIALOG_KEY;
  readonly routeConfirming = signal(false);
  readonly navigationBlocked = signal(false);
  private readonly unavailableRoomLabel = toSignal(merge(this.translate.stream('guide.areas.unavailableRoom'), this.translate.getStreamOnTranslationChange('guide.areas.unavailableRoom')), { initialValue: '' });
  private confirming = false;
  private draggedIndex: number | null = null;
  readonly original = signal<GuideArea | null>(null);
  readonly activeCount = computed(() => this.state.areas().filter(a => a.active && this.state.roomIsEligible(a.roomPublicId)).length);
  readonly inactiveCount = computed(() => this.state.areas().filter(a => !a.active).length);
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
    active: [true],
  });

  constructor() {
    // A kept attendance draft is only valid for the immediate return to the new-entry form.
    this.destroy.onDestroy(() => {
      const target = this.router.currentNavigation()?.finalUrl;
      if (!target || this.router.serializeUrl(target).split(/[?#]/)[0] !== '/guide/attendance/new') this.draft.value = null;
    });
    for (const key of ['roomPublicId', 'label', 'active'] as const) {
      const control: AbstractControl = this.form.controls[key];
      control.valueChanges.pipe(takeUntilDestroyed(this.destroy))
        .subscribe(() => this.state.clearFieldError(key));
    }
    this.state.load();
  }

  open(area: GuideArea | null = null): void {
    if (!this.canWrite() || this.state.saving() || this.state.loading() || this.state.loadFailed() || this.state.ordering()) return;
    this.original.set(area);
    this.state.clearFailure();
    this.form.reset({ roomPublicId: area?.roomPublicId ?? '', label: area?.label ?? '',
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
    if (this.form.invalid || this.invalidRoom()) return;
    this.navigationBlocked.set(false);
    this.form.disable({ emitEvent: false });
    this.state.save({ roomPublicId: value.roomPublicId, label: value.label.trim(), active: value.active }, this.original())
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
      message: this.translate.instant(this.state.ordering() ? 'guide.areas.discardOrderMessage' : 'guide.areas.discardMessage'),
      icon: 'pi pi-exclamation-triangle', acceptButtonStyleClass: 'p-button-danger',
      acceptLabel: this.translate.instant('guide.areas.discard'), rejectLabel: this.translate.instant('common.unsavedChanges.stay'),
      accept: () => { this.confirming = false; action(); }, reject: () => { this.confirming = false; } });
  }

  fieldError(name: string): boolean {
    const control = this.form.get(name);
    return !!(control?.touched && control.invalid) || !!this.state.fieldErrors()[name];
  }

  hasUnsavedChanges(): boolean { return this.state.saving() || (this.visible() && this.form.dirty) || this.state.orderDirty(); }

  @HostListener('document:keydown.escape', ['$event'])
  escape(event: Event): void {
    if (!this.confirming && !this.routeConfirming() && !event.defaultPrevented) {
      if (this.visible()) this.close();
      else if (this.state.ordering()) this.cancelOrdering();
    }
  }

  startOrdering(): void {
    if (!this.visible()) this.state.beginOrdering();
  }

  cancelOrdering(): void {
    if (this.state.saving()) return;
    this.confirmDiscard(() => {
      const stale = this.state.failure() === 'conflict' || this.state.failure() === 'notFound';
      this.state.cancelOrdering();
      if (stale) this.state.load();
    });
  }

  saveOrdering(): void {
    this.state.saveOrder().pipe(takeUntilDestroyed(this.destroy)).subscribe({ error: () => undefined });
  }

  startDrag(index: number): void { this.draggedIndex = this.state.ordering() && this.canWrite() ? index : null; }
  endDrag(): void { this.draggedIndex = null; }
  drop(index: number): void {
    if (this.draggedIndex !== null) this.state.move(this.draggedIndex, index);
    this.endDrag();
  }

  setActive(area: GuideArea): void {
    if (this.visible() || this.state.ordering()) return;
    this.state.save({ roomPublicId: area.roomPublicId, label: area.label, active: !area.active }, area)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({ error: () => undefined });
  }

  remove(area: GuideArea): void {
    if (!this.canWrite() || area.active || this.visible() || this.state.ordering() || this.state.saving() || this.state.loading() || this.state.loadFailed()) return;
    this.confirmation.confirm({ key: 'guide-remove', header: this.translate.instant('guide.areas.removeTitle', { label: area.label }),
      message: this.translate.instant('guide.areas.removeMessage'), icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger', acceptLabel: this.translate.instant('guide.areas.remove'),
      rejectLabel: this.translate.instant('guide.areas.cancel'),
      accept: () => this.state.remove(area).pipe(takeUntilDestroyed(this.destroy)).subscribe({ error: () => undefined }) });
  }

  reloadConfiguration(): void {
    if (this.state.saving()) return;
    this.confirmDiscard(() => { this.state.cancelOrdering(); this.state.load(); });
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
