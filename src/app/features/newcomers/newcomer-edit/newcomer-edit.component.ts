import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService } from 'primeng/api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
import { SegmentedControlComponent } from '../../../core/ui/segmented-control/segmented-control.component';
import { NewcomerService } from '../newcomer.service';
import { Baptism, Gender } from '../../../core/models/member.model';
import {
  CHURCH_EXPERIENCES,
  ChurchExperience,
  CreateNewcomerRequest,
  NEWCOMER_IDENTITY_STATUSES,
  Newcomer,
  NewcomerIdentityStatus,
  NewcomerOption,
  POST_ASSIGNMENT_ATTENDANCES,
  PostAssignmentAttendance,
} from '../../../core/models/newcomer.model';
import { isoToLocalDate, localDateToIso } from '../../../core/models/member-activity.model';
import { injectAppLang } from '../../../core/i18n/language';
import {
  PHONE_COUNTRIES,
  PhoneCountry,
  isValidMobile,
  normalizeToE164,
  parseE164,
} from '../../../core/models/phone.util';
import { HasUnsavedChanges, UNSAVED_CHANGES_DIALOG_KEY } from '../../../core/guards/unsaved-changes.guard';
import { COHORT_NUMBERS } from '../newcomer-detail/newcomer-graduate-dialog.component';

const GENDERS: readonly Gender[] = ['M', 'F'];
const BAPTISMS: readonly Baptism[] = ['INFANT_BAPTIZED', 'GENERAL_BAPTIZED', 'CONFIRMATION', 'UNBAPTIZED'];

/** Validates the mobile number against the country chosen in the sibling control. */
const mobileValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = (control.value ?? '') as string;
  if (!value.trim()) return null;
  const country = (control.parent?.get('phoneCountry')?.value ?? 'DE') as PhoneCountry;
  return isValidMobile(country, value) ? null : { invalidMobile: true };
};

/** Empty strings and nulls are left out, so a create only carries what was filled in. */
function text(value: string | null | undefined): string | undefined {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Figma: 새가족 수정 / 추가 (324:23444) — one card 새가족 정보 in three columns
 * plus 특이사항 across. Both routes (`new`, `:publicId/edit`) share this component.
 */
@Component({
  selector: 'app-newcomer-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    DatePickerModule,
    TextareaModule,
    ToastModule,
    ConfirmDialogModule,
    TranslatePipe,
    PageHeaderComponent,
    SkeletonComponent,
    EmptyStateComponent,
    SegmentedControlComponent,
  ],
  providers: [MessageService],
  templateUrl: './newcomer-edit.component.html',
})
export class NewcomerEditComponent implements OnInit, HasUnsavedChanges {
  private readonly newcomerService = inject(NewcomerService);
  private readonly route           = inject(ActivatedRoute);
  private readonly router          = inject(Router);
  private readonly fb              = inject(FormBuilder);
  private readonly messageService  = inject(MessageService);
  private readonly destroyRef      = inject(DestroyRef);
  private readonly translate       = inject(TranslateService);
  private readonly lang            = injectAppLang();

  readonly unsavedChangesDialogKey = UNSAVED_CHANGES_DIALOG_KEY;

  readonly isEdit   = signal(false);
  readonly loading  = signal(false);
  readonly saving   = signal(false);
  readonly notFound = signal(false);

  private publicId?: string;
  private readonly loaded = signal<Newcomer | null>(null);

  readonly caregivers = signal<NewcomerOption[]>([]);
  readonly groups     = signal<NewcomerOption[]>([]);

  readonly phoneCountryOptions = PHONE_COUNTRIES;

  readonly form = this.fb.group({
    lastName:                 ['', Validators.required],
    firstName:                ['', Validators.required],
    gender:                   [null as Gender | null, Validators.required],
    birthDate:                [null as Date | null, Validators.required],
    identityStatus:           [null as NewcomerIdentityStatus | null],
    workOrSchool:             [''],
    phoneCountry:             ['DE' as PhoneCountry],
    phoneLocal:               ['', [Validators.required, mobileValidator]],
    email:                    ['', Validators.email],
    kakaoId:                  [''],
    street:                   [''],
    baptism:                  [null as Baptism | null],
    churchExperience:         [null as ChurchExperience | null],
    registrationDate:         [null as Date | null],
    intakeRound:              [null as number | null],
    caregiverPublicId:        [null as string | null],
    assignedGroupPublicId:    [null as string | null],
    assignmentReason:         [''],
    postAssignmentAttendance: [null as PostAssignmentAttendance | null],
    overallNotes:             [''],
  });

  /** 남 / 여 for the segmented control, which is no form control and is synced by hand. */
  readonly genderOptions = computed(() => this.options('newcomers.gender', GENDERS));
  readonly gender = signal('');

  readonly identityOptions = computed(() =>
    this.options('newcomers.identity', NEWCOMER_IDENTITY_STATUSES));
  readonly baptismOptions = computed(() => this.options('members.baptism', BAPTISMS));
  readonly churchExperienceOptions = computed(() =>
    this.options('newcomers.churchExperience', CHURCH_EXPERIENCES));
  readonly attendanceOptions = computed(() =>
    this.options('newcomers.attendance', POST_ASSIGNMENT_ATTENDANCES));
  readonly intakeRoundOptions = computed(() => {
    this.lang();
    return COHORT_NUMBERS.map(n => ({
      value: n,
      label: this.translate.instant('newcomers.intakeRound', { n }) as string,
    }));
  });
  readonly caregiverOptions = computed(() =>
    this.caregivers().map(c => ({ value: c.publicId, label: c.label })));
  readonly groupOptions = computed(() =>
    this.groups().map(g => ({ value: g.publicId, label: g.label })));

  readonly heading = computed(() => {
    this.lang();
    const n = this.loaded();
    if (n) return `${n.lastName}${n.firstName}`;
    return this.translate.instant(this.isEdit() ? 'newcomers.form.editHeading' : 'newcomers.form.createHeading') as string;
  });

  readonly subtitle = computed(() => {
    this.lang();
    return this.translate.instant(
      this.isEdit() ? 'newcomers.form.editSubtitle' : 'newcomers.form.createSubtitle') as string;
  });

  readonly breadcrumb = computed(() => {
    this.lang();
    const title = this.translate.instant('newcomers.title') as string;
    const n = this.loaded();
    if (!this.isEdit()) return [title, this.translate.instant('newcomers.addButton') as string];
    return [
      title,
      ...(n ? [`${n.lastName}${n.firstName}`] : []),
      this.translate.instant('newcomers.detail.edit') as string,
    ];
  });

  get phonePlaceholder(): string {
    return this.form.get('phoneCountry')!.value === 'KR' ? '10 1234 5678' : '151 2345678';
  }

  ngOnInit(): void {
    this.publicId = this.route.snapshot.paramMap.get('publicId') ?? undefined;
    this.isEdit.set(!!this.publicId);

    this.newcomerService.getOptions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: o => {
          this.caregivers.set(o.caregivers);
          this.groups.set(o.groups);
        },
      });

    this.form.get('phoneCountry')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.get('phoneLocal')!.updateValueAndValidity());

    if (this.publicId) {
      this.loading.set(true);
      this.newcomerService.getNewcomer(this.publicId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: n => {
            this.loaded.set(n);
            this.patch(n);
            this.loading.set(false);
          },
          error: () => {
            this.notFound.set(true);
            this.loading.set(false);
          },
        });
    } else {
      this.form.patchValue({ registrationDate: new Date() });
      this.form.markAsPristine();
    }
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty;
  }

  onGenderChange(value: string): void {
    this.gender.set(value);
    const ctrl = this.form.get('gender')!;
    ctrl.setValue(value as Gender);
    ctrl.markAsDirty();
    ctrl.markAsTouched();
  }

  isInvalid(name: string): boolean {
    const ctrl = this.form.get(name)!;
    return ctrl.invalid && ctrl.touched;
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const request = this.toRequest();
    const done = this.translate.instant('newcomers.toast.done') as string;
    const error = this.translate.instant('newcomers.toast.error') as string;

    const call = this.publicId
      ? this.newcomerService.updateNewcomer(this.publicId, { ...request, version: this.loaded()!.version })
      : this.newcomerService.createNewcomer(request);

    call.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: saved => {
        this.messageService.add({
          severity: 'success',
          summary: done,
          detail: this.translate.instant(this.publicId ? 'newcomers.form.toast.updated' : 'newcomers.form.toast.created') as string,
        });
        this.newcomerService.refreshCounts();
        this.newcomerService.loadNewcomers();
        this.form.markAsPristine();
        this.saving.set(false);
        this.router.navigate(['/newcomers', saved.publicId]);
      },
      error: (err: { status?: number }) => {
        const key = err?.status === 409 ? 'newcomers.form.toast.conflict' : 'newcomers.form.toast.saveFailed';
        this.messageService.add({ severity: 'error', summary: error, detail: this.translate.instant(key) as string });
        this.saving.set(false);
      },
    });
  }

  goBack(): void {
    if (this.publicId) {
      this.router.navigate(['/newcomers', this.publicId]);
    } else {
      this.router.navigate(['/newcomers']);
    }
  }

  private options<T extends string>(prefix: string, values: readonly T[]): { value: T; label: string }[] {
    // `instant` is not reactive; reading the language makes the labels recompute on a switch.
    this.lang();
    return values.map(value => ({ value, label: this.translate.instant(`${prefix}.${value}`) as string }));
  }

  private patch(n: Newcomer): void {
    const phone = n.phoneNumber ? parseE164(n.phoneNumber) : null;
    this.form.patchValue({
      lastName:                 n.lastName,
      firstName:                n.firstName,
      gender:                   n.gender,
      birthDate:                n.birthDate ? isoToLocalDate(n.birthDate) : null,
      identityStatus:           n.identityStatus,
      workOrSchool:             n.workOrSchool ?? '',
      phoneCountry:             phone?.country ?? 'DE',
      phoneLocal:               phone?.local ?? '',
      email:                    n.email ?? '',
      kakaoId:                  n.kakaoId ?? '',
      street:                   n.street ?? '',
      baptism:                  n.baptism,
      churchExperience:         n.churchExperience,
      registrationDate:         n.registrationDate ? isoToLocalDate(n.registrationDate) : null,
      intakeRound:              n.intakeRound,
      caregiverPublicId:        n.caregiver?.publicId ?? null,
      assignedGroupPublicId:    n.assignedGroup?.publicId ?? null,
      assignmentReason:         n.assignmentReason ?? '',
      postAssignmentAttendance: n.postAssignmentAttendance,
      overallNotes:             n.overallNotes ?? '',
    });
    this.gender.set(n.gender ?? '');
    this.form.markAsPristine();
  }

  private toRequest(): CreateNewcomerRequest {
    const v = this.form.getRawValue();
    const local = text(v.phoneLocal);
    return {
      lastName:                 v.lastName!.trim(),
      firstName:                v.firstName!.trim(),
      gender:                   v.gender ?? undefined,
      birthDate:                localDateToIso(v.birthDate) ?? undefined,
      identityStatus:           v.identityStatus ?? undefined,
      workOrSchool:             text(v.workOrSchool),
      phoneNumber:              local ? normalizeToE164(v.phoneCountry!, local) ?? undefined : undefined,
      email:                    text(v.email),
      kakaoId:                  text(v.kakaoId),
      street:                   text(v.street),
      baptism:                  v.baptism ?? undefined,
      churchExperience:         v.churchExperience ?? undefined,
      registrationDate:         localDateToIso(v.registrationDate) ?? undefined,
      intakeRound:              v.intakeRound ?? undefined,
      caregiverPublicId:        v.caregiverPublicId ?? undefined,
      assignedGroupPublicId:    v.assignedGroupPublicId ?? undefined,
      assignmentReason:         text(v.assignmentReason),
      postAssignmentAttendance: v.postAssignmentAttendance ?? undefined,
      overallNotes:             text(v.overallNotes),
    };
  }
}
