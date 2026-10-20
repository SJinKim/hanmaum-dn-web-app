import { Component, DestroyRef, HostListener, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DatePickerModule } from 'primeng/datepicker';
import { TableModule } from 'primeng/table';
import { TextareaModule } from 'primeng/textarea';
import { HasUnsavedChanges, UNSAVED_CHANGES_DIALOG_KEY } from '../../core/guards/unsaved-changes.guard';
import { EmptyStateComponent } from '../../core/ui/empty-state/empty-state.component';
import { SkeletonComponent } from '../../core/ui/skeleton/skeleton.component';
import { GuideAttendanceService } from './guide-attendance.service';
import { GuideCountFieldComponent } from './guide-count-field.component';
import { GuideCountField, GuideServiceNumber } from './guide-details.model';
import { guideDateValue } from './guide-report.model';
@Component({
  selector: 'app-guide-attendance', standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, ButtonModule, ConfirmDialogModule, DatePickerModule,
    TableModule, TextareaModule, EmptyStateComponent, SkeletonComponent, GuideCountFieldComponent],
  providers: [GuideAttendanceService], host: { class: 'block min-w-0' }, templateUrl: './guide-attendance.component.html',
})
export class GuideAttendanceComponent implements HasUnsavedChanges {
  readonly state = inject(GuideAttendanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly translate = inject(TranslateService);
  private readonly destroy = inject(DestroyRef);
  readonly editing = signal(false);
  readonly services = [1, 2, 3] as const;
  readonly selectedService = signal<GuideServiceNumber>(1);
  readonly routeConfirming = signal(false);
  readonly navigationBlocked = signal(false);
  readonly unsavedChangesDialogKey = UNSAVED_CHANGES_DIALOG_KEY;
  readonly minimumDate = guideDateValue('0001-01-01');
  readonly maximumDate = guideDateValue('9999-12-31');
  private id: string | null = null;
  private confirming = false;
  private leavingForConfiguration = false;
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroy)).subscribe(params => {
      this.id = params.get('publicId'); this.editing.set(!!this.id); this.state.load(this.id);
    });
  }
  fields(service: GuideServiceNumber): GuideCountField[] { return service === 3 ? ['adultCount', 'youthCount', 'schoolCount'] : ['adultCount', 'schoolCount']; }
  path(area: string, service: GuideServiceNumber, field: GuideCountField): string { return `entries.${this.state.rowIndex(area, service)}.${field}`; }
  control(area: string, service: GuideServiceNumber, field: GuideCountField) { return this.state.form.controls.entries.at(this.state.rowIndex(area, service)).controls[field]; }
  hasServerErrors(): boolean { return Object.keys(this.state.fieldErrors()).length > 0; }
  navigateTabs(event: KeyboardEvent, service: GuideServiceNumber): void {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const next = event.key === 'Home' ? 1 : event.key === 'End' ? 3 : ((service - 1 + (event.key === 'ArrowLeft' ? 2 : 1)) % 3 + 1) as GuideServiceNumber;
    event.preventDefault(); this.selectedService.set(next);
    (event.currentTarget as HTMLElement).parentElement?.querySelector<HTMLElement>('#guide-service-' + next)?.focus();
  }
  count(value: number | null): string { return value === null ? '—' : value.toLocaleString('en-US'); }
  submit(): void {
    this.navigationBlocked.set(false);
    this.state.save().pipe(takeUntilDestroyed(this.destroy)).subscribe({ next: () => { void this.router.navigateByUrl('/guide'); }, error: () => { /* Preserve every base count. */ } });
  }
  reload(): void {
    if (this.state.source() || this.id) this.confirm('common.unsavedChanges.message', () => this.state.load(this.id));
    else this.state.load(null);
  }
  discardRemoved(): void { this.confirm('guide.details.removeMessage', () => this.state.discardRemoved(), true); }
  manage(): void {
    if (this.id || this.state.loading() || this.state.saving()) return;
    const navigate = () => {
      this.state.keepDraft(); this.leavingForConfiguration = true;
      void this.router.navigate(['/guide/counting-areas'], { queryParams: { returnTo: '/guide/attendance/new' } })
        .finally(() => { this.leavingForConfiguration = false; });
    };
    this.confirm('guide.details.manageMessage', navigate);
  }
  private confirm(message: string, action: () => void, always = false): void {
    if (this.state.saving() || this.confirming || this.routeConfirming()) return;
    if (!always && !this.state.form.dirty) { action(); return; }
    this.confirming = true;
    this.confirmation.confirm({ key: 'guide-details-confirm', header: this.translate.instant('guide.details.confirmTitle'),
      message: this.translate.instant(message), icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('guide.details.continue'), rejectLabel: this.translate.instant('guide.reports.cancel'),
      accept: () => { this.confirming = false; action(); }, reject: () => { this.confirming = false; } });
  }
  hasUnsavedChanges(): boolean { return this.state.saving() || (!this.leavingForConfiguration && this.state.form.dirty); }
  navigateCounts(event: KeyboardEvent): void {
    if (!['ArrowUp', 'ArrowDown'].includes(event.key) || !(event.target instanceof HTMLInputElement) || !event.target.dataset['countKey']) return;
    const inputs = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLInputElement>('input[data-count-key]'))
      .filter(input => input.dataset['countKey'] === (event.target as HTMLInputElement).dataset['countKey'] && !input.disabled && input.getClientRects().length);
    const next = inputs[inputs.indexOf(event.target) + (event.key === 'ArrowUp' ? -1 : 1)];
    if (next) { event.preventDefault(); next.focus(); next.select(); }
  }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    if (this.state.saving() || this.state.form.dirty) { event.preventDefault(); event.returnValue = ''; }
  }
}
