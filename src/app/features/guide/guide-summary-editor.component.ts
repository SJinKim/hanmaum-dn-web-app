import { Component, DestroyRef, HostListener, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { HasUnsavedChanges, UNSAVED_CHANGES_DIALOG_KEY } from '../../core/guards/unsaved-changes.guard';
import { EmptyStateComponent } from '../../core/ui/empty-state/empty-state.component';
import { SkeletonComponent } from '../../core/ui/skeleton/skeleton.component';
import { GuideCountInputDirective } from './guide-count-input.directive';
import { guideDateValue } from './guide-report.model';
import { GuideSummaryEditorService } from './guide-summary-editor.service';

@Component({
  selector: 'app-guide-summary-editor', standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, ButtonModule, ConfirmDialogModule, DatePickerModule,
    InputTextModule, TextareaModule, EmptyStateComponent, SkeletonComponent, GuideCountInputDirective],
  providers: [GuideSummaryEditorService], host: { class: 'block min-w-0' }, templateUrl: './guide-summary-editor.component.html',
})
export class GuideSummaryEditorComponent implements HasUnsavedChanges {
  readonly state = inject(GuideSummaryEditorService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly confirmation = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);
  readonly routeConfirming = signal(false);
  readonly navigationBlocked = signal(false);
  readonly unsavedChangesDialogKey = UNSAVED_CHANGES_DIALOG_KEY;
  readonly minimumDate = guideDateValue('0001-01-01');
  readonly maximumDate = guideDateValue('9999-12-31');
  readonly services = [{ number: 1, control: 'service1Count' }, { number: 2, control: 'service2Count' }, { number: 3, control: 'service3Count' }] as const;
  private confirming = false;
  private id = '';
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroy)).subscribe(params => {
      this.id = params.get('publicId') ?? ''; this.state.load(this.id);
    });
  }
  count(value: number | null): string { return value === null ? this.translate.instant('guide.reports.unknown') : value.toLocaleString('en-US'); }
  delta(value: number | null): string { return value === null ? '—' : `${value > 0 ? '+' : ''}${value.toLocaleString('en-US')}`; }
  submit(): void {
    this.navigationBlocked.set(false);
    this.state.save().pipe(takeUntilDestroyed(this.destroy)).subscribe({ next: () => { void this.router.navigateByUrl('/guide'); }, error: () => { /* Keep values; service displays failure. */ } });
  }
  reload(): void {
    if (this.state.saving() || this.confirming) return;
    if (!this.hasUnsavedChanges()) { this.state.load(this.id); return; }
    this.confirming = true;
    this.confirmation.confirm({ key: 'guide-summary-discard', header: this.translate.instant('common.unsavedChanges.header'),
      message: this.translate.instant('common.unsavedChanges.message'), icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger', acceptLabel: this.translate.instant('common.unsavedChanges.leave'),
      rejectLabel: this.translate.instant('common.unsavedChanges.stay'),
      accept: () => { this.confirming = false; this.state.load(this.id); }, reject: () => { this.confirming = false; } });
  }
  hasUnsavedChanges(): boolean { return this.state.saving() || this.state.form.dirty; }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) { event.preventDefault(); event.returnValue = ''; }
  }
}
