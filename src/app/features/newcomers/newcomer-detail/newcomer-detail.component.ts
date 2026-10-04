import { Component, DestroyRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MenuItem, MessageService } from 'primeng/api';
import { Menu, MenuModule } from 'primeng/menu';
import { ToastModule } from 'primeng/toast';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { NewcomerService } from '../newcomer.service';
import { ATTENDANCE_VARIANT } from '../newcomers-list/newcomers-list.component';
import { NewcomerGraduateDialogComponent } from './newcomer-graduate-dialog.component';
import { RoleService } from '../../../core/services/role.service';
import { Newcomer, NewcomerOption } from '../../../core/models/newcomer.model';
import { injectAppLang } from '../../../core/i18n/language';
import { formatForDisplay } from '../../../core/models/phone.util';
import { BadgeVariant } from '../../../core/ui/variant-tokens';
import { BadgeComponent } from '../../../core/ui/badge/badge.component';
import { DefinitionRowComponent } from '../../../core/ui/definition-list/definition-row.component';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { SectionHeaderComponent } from '../../../core/ui/section-header/section-header.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';

/**
 * 새가족 상세 (#43). Figma: 새가족 상세 · Desktop (324:21514). 수정 opens the
 * edit page, ⋮ holds 등반 and 삭제.
 */
@Component({
  selector: 'app-newcomer-detail',
  standalone: true,
  imports: [
    BadgeComponent,
    ButtonModule,
    ConfirmDialogModule,
    DefinitionRowComponent,
    EmptyStateComponent,
    MenuModule,
    NewcomerGraduateDialogComponent,
    PageHeaderComponent,
    SectionHeaderComponent,
    SkeletonComponent,
    ToastModule,
    TranslatePipe,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './newcomer-detail.component.html',
})
export class NewcomerDetailComponent implements OnInit {
  private readonly newcomerService = inject(NewcomerService);
  private readonly route           = inject(ActivatedRoute);
  private readonly router          = inject(Router);
  private readonly confirmService  = inject(ConfirmationService);
  private readonly messageService  = inject(MessageService);
  private readonly destroyRef      = inject(DestroyRef);
  private readonly translate       = inject(TranslateService);
  private readonly roles           = inject(RoleService);
  private readonly lang            = injectAppLang();

  protected readonly canWrite = computed(() => this.roles.canWrite('newcomers'));

  readonly newcomer = signal<Newcomer | null>(null);
  readonly loading  = signal(true);
  readonly failed   = signal(false);
  readonly groups   = signal<NewcomerOption[]>([]);
  readonly graduateOpen = signal(false);

  readonly formatPhone = formatForDisplay;

  private readonly moreMenu = viewChild<Menu>('moreMenu');

  readonly fullName = computed(() => {
    const n = this.newcomer();
    return n ? `${n.lastName}${n.firstName}` : '';
  });

  readonly isGraduated = computed(() => this.newcomer()?.lifecycleStatus === 'GRADUATED');

  readonly breadcrumb = computed(() => {
    this.lang();
    return [this.translate.instant('newcomers.title') as string, this.fullName()];
  });

  /** "{n}기 · {등록일} 등록 · 담당 {담당자}", leaving out whatever is unknown. */
  readonly subtitle = computed(() => {
    this.lang();
    const n = this.newcomer();
    if (!n) return '';
    const parts: string[] = [];
    if (n.intakeRound) parts.push(this.translate.instant('newcomers.intakeRound', { n: n.intakeRound }) as string);
    if (n.registrationDate) parts.push(this.translate.instant('newcomers.detail.registeredOn', { date: n.registrationDate }) as string);
    if (n.caregiver) parts.push(this.translate.instant('newcomers.detail.caredBy', { name: n.caregiver.label }) as string);
    return parts.join(' · ');
  });

  /** "Straße Hausnummer, PLZ Ort", leaving out whatever is missing; `—` when all is. */
  readonly address = computed(() => {
    const n = this.newcomer();
    if (!n) return '—';
    const line1 = [n.street, n.houseNumber].filter(Boolean).join(' ');
    const line2 = [n.zipCode, n.city].filter(Boolean).join(' ');
    return [line1, line2].filter(Boolean).join(', ') || '—';
  });

  readonly attendance = computed<{ label: string; variant: BadgeVariant } | null>(() => {
    this.lang();
    const a = this.newcomer()?.postAssignmentAttendance;
    return a ? { variant: ATTENDANCE_VARIANT[a], label: this.translate.instant(`newcomers.attendance.${a}`) as string } : null;
  });

  readonly moreItems = computed<MenuItem[]>(() => {
    this.lang();
    const items: MenuItem[] = [];
    if (!this.isGraduated()) {
      items.push({
        label: this.translate.instant('newcomers.detail.graduate') as string,
        icon: 'pi pi-arrow-up-right',
        command: () => this.graduateOpen.set(true),
      });
    }
    items.push({
      label: this.translate.instant('newcomers.detail.delete') as string,
      icon: 'pi pi-trash',
      command: ({ originalEvent }) => this.confirmDelete(originalEvent as Event),
    });
    return items;
  });

  ngOnInit(): void {
    this.load();
    if (this.canWrite()) {
      this.newcomerService.getOptions()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: o => this.groups.set(o.groups) });
    }
  }

  load(): void {
    const publicId = this.route.snapshot.paramMap.get('publicId')!;
    this.loading.set(true);
    this.failed.set(false);
    this.newcomerService.getNewcomer(publicId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: n => { this.newcomer.set(n); this.loading.set(false); },
        error: () => { this.failed.set(true); this.loading.set(false); },
      });
  }

  label(prefix: string, value: string | null): string {
    return value ? this.translate.instant(`${prefix}.${value}`) as string : '—';
  }

  intakeRound(n: Newcomer): string {
    return n.intakeRound ? this.translate.instant('newcomers.intakeRound', { n: n.intakeRound }) as string : '—';
  }

  goToEdit(): void {
    this.router.navigate(['/newcomers', this.newcomer()!.publicId, 'edit']);
  }

  goBack(): void {
    this.router.navigate(['/newcomers']);
  }

  toggleMore(event: Event): void {
    this.moreMenu()?.toggle(event);
  }

  /** After 등반 the newcomer is re-read so 상태 and 순 reflect the server. */
  onGraduated(): void {
    this.newcomerService.refreshCounts();
    this.newcomerService.loadNewcomers();
    this.load();
  }

  confirmDelete(event: Event): void {
    this.confirmService.confirm({
      target: event.target as EventTarget,
      message: this.translate.instant('newcomers.detail.deleteDialog.message', { name: this.fullName() }),
      header: this.translate.instant('newcomers.detail.deleteDialog.header'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('newcomers.detail.deleteDialog.accept'),
      rejectLabel: this.translate.instant('newcomers.form.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.newcomerService.deleteNewcomer(this.newcomer()!.publicId)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.messageService.add({
                severity: 'success',
                summary: this.translate.instant('newcomers.toast.done'),
                detail: this.translate.instant('newcomers.detail.toast.deleted'),
              });
              this.newcomerService.refreshCounts();
              this.newcomerService.loadNewcomers();
              setTimeout(() => this.router.navigate(['/newcomers']), 1000);
            },
            error: () => {
              this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('newcomers.toast.error'),
                detail: this.translate.instant('newcomers.detail.toast.deleteFailed'),
              });
            },
          });
      },
    });
  }
}
