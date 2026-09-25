import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, of, switchMap } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { injectAppLang } from '../../../core/i18n/language';
import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { SectionHeaderComponent } from '../../../core/ui/section-header/section-header.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';
import { MinistryService } from '../ministry.service';
import {
  CreateMinistryRequest, Ministry, MinistryContact, MinistrySchedule, UpdateMinistryRequest,
} from '../ministry.model';

export const TITLE_MAX = 100;
export const SUBTITLE_MAX = 200;
export const LIST_MAX = 20;
export const SCHEDULE_DESCRIPTION_MAX = 200;
export const LEADER_ROLE = '리더';

/**
 * Figma: 사역 정보 수정 (204:7690) and 새 사역 추가 (285:21140) share this form;
 * the order 사역명 · 리더 · 상태 / 한 줄 소개 / 설명 follows the user's design change.
 *
 * Fields map to the contract: 한 줄 소개 → `subtitle` (the mobile list line),
 * 설명 → `about` (mobile "우리의 마음"), 모임 시간 → `schedules`,
 * 참여 조건 → `requirements`. The API has no leader field: the mobile app shows
 * the first contact as 리더, so the picked name goes to `contacts[0]` and any
 * further contacts are kept. The image is kept as stored.
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
    TextareaModule,
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

  private readonly fb              = inject(FormBuilder).nonNullable;

  readonly titleMax    = TITLE_MAX;
  readonly subtitleMax = SUBTITLE_MAX;
  readonly listMax     = LIST_MAX;
  readonly scheduleDescriptionMax = SCHEDULE_DESCRIPTION_MAX;

  private readonly publicId = this.route.snapshot.paramMap.get('publicId') ?? '';
  readonly isEdit = !!this.publicId;

  readonly ministry    = signal<Ministry | null>(null);
  readonly memberCount = signal(0);
  readonly loading     = signal(this.isEdit);
  readonly saving      = signal(false);
  /** Names for the 리더 picker; the stored leader is added if it is not a member. */
  readonly memberNames = signal<string[]>([]);

  readonly form = this.fb.group({
    title:        ['', [Validators.required, Validators.maxLength(TITLE_MAX)]],
    isActive:     [true],
    leader:       [null as string | null],
    // Required only for a new ministry, as before; mobile lists it under the name.
    subtitle:     ['', this.isEdit
      ? [Validators.maxLength(SUBTITLE_MAX)]
      : [Validators.required, Validators.maxLength(SUBTITLE_MAX)]],
    about:        ['', [Validators.required, Validators.pattern(/\S/)]],
    schedules:    this.fb.array<FormGroup>([], Validators.maxLength(LIST_MAX)),
    requirements: this.fb.array<string>([], Validators.maxLength(LIST_MAX)),
  });

  get schedules(): FormArray<FormGroup> { return this.form.controls.schedules; }
  get requirements(): FormArray { return this.form.controls.requirements; }

  readonly leaderOptions = computed(() => {
    const names = new Set(this.memberNames());
    const stored = this.ministry()?.contacts[0]?.name;
    if (stored) names.add(stored);
    return [...names].sort((a, b) => a.localeCompare(b, 'ko')).map(name => ({ label: name, value: name }));
  });

  readonly statusOptions = computed(() => {
    this.lang();
    return [
      { value: true,  label: this.translate.instant('ministry.form.status.active') as string },
      { value: false, label: this.translate.instant('ministry.form.status.inactive') as string },
    ];
  });

  /** Sizes the 상태 select to its longest option, e.g. 운영 중. */
  readonly statusLongestLabel = computed(() =>
    this.statusOptions().reduce((a, o) => (o.label.length > a.length ? o.label : a), ''));

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
    // The picker only offers names; a failure leaves it with the stored leader.
    this.ministryService.getMemberNames()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: dtos => this.memberNames.set(dtos.map(d => d.fullName)), error: () => undefined });

    if (!this.isEdit) return;

    this.ministryService.getMinistry(this.publicId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: m => {
          this.ministry.set(m);
          this.form.patchValue({
            title: m.title,
            isActive: m.isActive,
            leader: m.contacts[0]?.name ?? null,
            subtitle: m.subtitle,
            about: m.about,
          });
          m.schedules.forEach(s => this.schedules.push(this.newSchedule(s)));
          m.requirements.forEach(r => this.requirements.push(this.fb.control(r)));
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

  hasError(control: 'title' | 'subtitle' | 'about', error: 'required' | 'maxlength'): boolean {
    const c = this.form.controls[control];
    // `about` also fails `pattern` when it holds only whitespace.
    const failed = c.hasError(error) || (error === 'required' && c.hasError('pattern'));
    return failed && (c.touched || c.dirty);
  }

  /** A row of 모임 시간 is invalid only once one of its fields has been touched. */
  scheduleInvalid(index: number): boolean {
    const row = this.schedules.at(index);
    return row.invalid && (row.touched || row.dirty);
  }

  addSchedule(): void {
    if (this.schedules.length < LIST_MAX) this.schedules.push(this.newSchedule());
  }

  removeSchedule(index: number): void { this.schedules.removeAt(index); }

  addRequirement(): void {
    if (this.requirements.length < LIST_MAX) this.requirements.push(this.fb.control(''));
  }

  removeRequirement(index: number): void { this.requirements.removeAt(index); }

  save(): void {
    this.dropBlankRows();
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
    const { isActive, ...fields } = this.editedFields();
    const request: CreateMinistryRequest = { ...fields, imageUrl: null };
    return this.ministryService.createMinistry(request).pipe(
      switchMap(created => isActive
        ? of(created)
        : this.ministryService.updateMinistry(created.publicId, { ...toUpdateRequest(created), isActive: false })),
    );
  }

  private editedFields(): Omit<UpdateMinistryRequest, 'imageUrl'> {
    const v = this.form.getRawValue();
    return {
      title: v.title.trim(),
      subtitle: v.subtitle.trim(),
      about: v.about.trim(),
      requirements: v.requirements.map(r => r.trim()),
      schedules: (v.schedules as MinistrySchedule[]).map(s => ({ ...s, description: s.description.trim() })),
      contacts: this.contacts(v.leader),
      isActive: v.isActive,
    };
  }

  /** The leader leads `contacts`, keeping the stored role; later contacts pass through. */
  private contacts(leader: string | null): MinistryContact[] {
    const [first, ...rest] = this.ministry()?.contacts ?? [];
    const name = leader?.trim();
    return name ? [{ role: first?.role || LEADER_ROLE, name }, ...rest] : rest;
  }

  private newSchedule(s?: MinistrySchedule): FormGroup {
    return this.fb.group({
      description: [s?.description ?? '', [Validators.required, Validators.maxLength(SCHEDULE_DESCRIPTION_MAX)]],
      startTime:   [s?.startTime ?? '', Validators.required],
      endTime:     [s?.endTime ?? '', Validators.required],
    });
  }

  /** Rows the user added but left empty are not an error; they are just not sent. */
  private dropBlankRows(): void {
    for (let i = this.schedules.length - 1; i >= 0; i--) {
      const { description, startTime, endTime } = this.schedules.at(i).getRawValue();
      if (!description.trim() && !startTime && !endTime) this.schedules.removeAt(i);
    }
    for (let i = this.requirements.length - 1; i >= 0; i--) {
      if (!this.requirements.at(i).value.trim()) this.requirements.removeAt(i);
    }
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
