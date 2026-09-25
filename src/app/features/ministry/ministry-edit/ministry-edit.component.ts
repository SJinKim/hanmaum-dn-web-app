import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, of, switchMap } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { injectAppLang } from '../../../core/i18n/language';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { SectionHeaderComponent } from '../../../core/ui/section-header/section-header.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';
import { MinistryService } from '../ministry.service';
import { CreateMinistryRequest, Ministry, UpdateMinistryRequest } from '../ministry.model';

export const TITLE_MAX = 100;
export const SUBTITLE_MAX = 200;

/**
 * Figma: 사역 정보 수정 (204:7690) and 새 사역 추가 (285:21140) share this form.
 *
 * 설명 is the ministry's `subtitle`, the short line the detail header shows.
 * The server also requires `about`: a new ministry takes 설명 for it, an edit
 * keeps the stored one along with requirements, schedules, contacts and image.
 * 리더 stays disabled until the API carries a leader (hanmaum-dn-server#214).
 */
@Component({
  selector: 'app-ministry-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ButtonModule,
    InputTextModule,
    SelectModule,
    ToastModule,
    PageHeaderComponent,
    SectionHeaderComponent,
    SkeletonComponent,
  ],
  providers: [MessageService],
  templateUrl: './ministry-edit.component.html',
})
export class MinistryEditComponent implements OnInit {
  private readonly ministryService = inject(MinistryService);
  private readonly route           = inject(ActivatedRoute);
  private readonly router          = inject(Router);
  private readonly translate       = inject(TranslateService);
  private readonly messageService  = inject(MessageService);
  private readonly destroyRef      = inject(DestroyRef);
  private readonly lang            = injectAppLang();

  readonly titleMax    = TITLE_MAX;
  readonly subtitleMax = SUBTITLE_MAX;

  private readonly publicId = this.route.snapshot.paramMap.get('publicId') ?? '';
  readonly isEdit = !!this.publicId;

  readonly ministry    = signal<Ministry | null>(null);
  readonly memberCount = signal(0);
  readonly loading     = signal(this.isEdit);
  readonly saving      = signal(false);

  readonly form = inject(FormBuilder).nonNullable.group({
    title:    ['', [Validators.required, Validators.maxLength(TITLE_MAX)]],
    // Required only for a new ministry, which sends it as `about` too.
    subtitle: ['', this.isEdit
      ? [Validators.maxLength(SUBTITLE_MAX)]
      : [Validators.required, Validators.maxLength(SUBTITLE_MAX)]],
    leader:   [{ value: null as string | null, disabled: true }],
    isActive: [true],
  });

  readonly statusOptions = computed(() => {
    this.lang();
    return [
      { value: true,  label: this.translate.instant('ministry.form.status.active') as string },
      { value: false, label: this.translate.instant('ministry.form.status.inactive') as string },
    ];
  });

  readonly breadcrumb = computed(() => {
    this.lang();
    const t = (key: string) => this.translate.instant(key) as string;
    return this.isEdit
      ? [t('ministry.title'), this.ministry()?.title ?? '', t('ministry.form.breadcrumbEdit')]
      : [t('ministry.title'), t('ministry.form.breadcrumbNew')];
  });

  readonly heading = computed(() => {
    this.lang();
    return this.translate.instant(this.isEdit ? 'ministry.form.editTitle' : 'ministry.form.newTitle') as string;
  });

  /** Edit: "{title} · 팀원 N명", as on the detail page. New: a fixed line. */
  readonly subtitle = computed(() => {
    this.lang();
    if (!this.isEdit) return this.translate.instant('ministry.form.newSubtitle') as string;
    const m = this.ministry();
    if (!m) return '';
    const count = this.translate.instant('ministry.memberCount', { count: this.memberCount() }) as string;
    return [m.title, count].join(' · ');
  });

  ngOnInit(): void {
    if (!this.isEdit) return;

    this.ministryService.getMinistry(this.publicId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: m => {
          this.ministry.set(m);
          this.form.patchValue({ title: m.title, subtitle: m.subtitle, isActive: m.isActive });
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toastError('ministry.form.toast.loadFailed');
        },
      });

    // The count only decorates the subtitle; a failure leaves it at 0.
    this.ministryService.getActiveMembers(this.publicId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: members => this.memberCount.set(members.length), error: () => undefined });
  }

  hasError(control: 'title' | 'subtitle', error: 'required' | 'maxlength'): boolean {
    const c = this.form.controls[control];
    return c.hasError(error) && (c.touched || c.dirty);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const request$ = this.isEdit ? this.update$() : this.create$();

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ministry => this.router.navigate(['/ministry', ministry.publicId]),
      error: () => {
        this.saving.set(false);
        this.toastError(this.isEdit ? 'ministry.form.toast.saveFailed' : 'ministry.form.toast.createFailed');
      },
    });
  }

  goBack(): void {
    this.router.navigate(this.isEdit ? ['/ministry', this.publicId] : ['/ministry']);
  }

  private update$(): Observable<Ministry> {
    const m = this.ministry()!;
    return this.ministryService.updateMinistry(this.publicId, {
      ...toUpdateRequest(m),
      ...this.editedFields(),
    });
  }

  /** POST cannot carry `isActive`; a ministry created as 비활성 is patched right after. */
  private create$(): Observable<Ministry> {
    const { title, subtitle, isActive } = this.editedFields();
    const request: CreateMinistryRequest = {
      title,
      subtitle,
      about: subtitle,
      requirements: [],
      schedules: [],
      contacts: [],
      imageUrl: null,
    };
    return this.ministryService.createMinistry(request).pipe(
      switchMap(created => isActive
        ? of(created)
        : this.ministryService.updateMinistry(created.publicId, { ...toUpdateRequest(created), isActive: false })),
    );
  }

  private editedFields(): Pick<UpdateMinistryRequest, 'title' | 'subtitle' | 'isActive'> {
    const { title, subtitle, isActive } = this.form.getRawValue();
    return { title: title.trim(), subtitle: subtitle.trim(), isActive };
  }

  private toastError(detailKey: string): void {
    this.messageService.add({
      severity: 'error',
      summary: this.translate.instant('ministry.form.toast.error'),
      detail: this.translate.instant(detailKey),
    });
  }
}

/** The PATCH replaces every field, so start from what the server holds. */
function toUpdateRequest(m: Ministry): UpdateMinistryRequest {
  return {
    title: m.title,
    subtitle: m.subtitle,
    about: m.about,
    requirements: m.requirements,
    schedules: m.schedules,
    contacts: m.contacts,
    // PATCH treats null as "not supplied"; '' would clear the image.
    imageUrl: m.imageUrl ?? '',
    isActive: m.isActive,
  };
}
