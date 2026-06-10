import { Component, OnInit, DestroyRef, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, of, switchMap } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { MemberService } from '../member.service';
import {
  MEMBER_STATUS_OPTIONS,
  GENDER_OPTIONS,
  BAPTISM_OPTIONS,
  Member,
  Gender,
  Baptism,
  MemberStatus,
  ChurchGroupSummary,
} from '../../../core/models/member.model';
import {
  TRAINING_TYPE_OPTIONS,
  MONTH_OPTIONS,
  YEAR_OPTIONS,
  MAX_TRAININGS,
  TrainingType,
  TrainingFormValue,
  TrainingCatalogEntry,
  MemberTrainingItem,
  UserTraining,
  mapUserTrainingToFormValue,
  mapFormValueToItem,
  MinistryCatalogEntry,
  MemberMinistryItem,
  MinistryFormValue,
  MinistryHistory,
  monthYearToFirstOfMonth,
  firstOfMonthToMonthYear,
} from '../../../core/models/member-activity.model';
import {
  PHONE_COUNTRIES,
  PhoneCountry,
  isValidMobile,
  normalizeToE164,
  parseE164,
} from '../../../core/models/phone.util';

/** Validates the mobile number against the country chosen in the sibling control. Empty = valid (phone is optional). */
const mobileValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = (control.value ?? '') as string;
  if (!value.trim()) return null;
  const country = (control.parent?.get('phoneCountry')?.value ?? 'DE') as PhoneCountry;
  return isValidMobile(country, value) ? null : { invalidMobile: true };
};

@Component({
  selector: 'app-member-edit',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    DatePickerModule,
    CheckboxModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './member-edit.component.html',
})
export class MemberEditComponent implements OnInit {
  private readonly memberService = inject(MemberService);
  private readonly route         = inject(ActivatedRoute);
  private readonly router        = inject(Router);
  private readonly fb            = inject(FormBuilder);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef    = inject(DestroyRef);

  readonly isEdit     = signal(false);
  readonly loading    = signal(false);
  readonly saving     = signal(false);

  /** Training catalog from the backend — maps the form's type enum to a publicId. */
  private readonly trainingCatalog = signal<TrainingCatalogEntry[]>([]);

  /** Ministry catalog from the backend — populates the ministry select options. */
  private readonly ministryCatalog = signal<MinistryCatalogEntry[]>([]);
  readonly ministryOptions = computed(() =>
    this.ministryCatalog().map(m => ({ value: m.publicId, label: m.name })));

  /** Church groups from the backend — populates the "Church Group" select. */
  private readonly churchGroups = signal<ChurchGroupSummary[]>([]);
  readonly groupOptions = computed(() =>
    this.churchGroups().map(g => ({
      value: g.publicId,
      label: g.division ? `${g.name} (${g.division})` : g.name,
    })));

  readonly phoneCountryOptions = PHONE_COUNTRIES;
  readonly statusOptions       = MEMBER_STATUS_OPTIONS;
  readonly genderOptions       = GENDER_OPTIONS;
  readonly baptismOptions      = BAPTISM_OPTIONS;
  readonly trainingTypeOptions = TRAINING_TYPE_OPTIONS;
  readonly monthOptions        = MONTH_OPTIONS;
  readonly yearOptions         = YEAR_OPTIONS;
  readonly maxTrainings        = MAX_TRAININGS;

  readonly form = this.fb.group({
    lastName:        ['', Validators.required],
    firstName:       ['', Validators.required],
    discriminator:   [''],
    gender:          [null as string | null],
    baptism:         [null as string | null],
    birthDate:       [null as Date | null],
    phoneCountry:    ['DE' as PhoneCountry],
    phoneLocal:      ['', mobileValidator],
    email:           ['', Validators.email],
    street:          [''],
    houseNumber:     [''],
    zipCode:         [''],
    city:            [''],
    registrationDate:[null as Date | null],
    groupPublicId:   [null as string | null],
    memberStatus:    [null as string | null],
    trainings:       this.fb.array<FormGroup>([]),
    ministries:      this.fb.array<FormGroup>([]),
  });

  get trainings(): FormArray<FormGroup> { return this.form.get('trainings') as FormArray<FormGroup>; }
  get ministries(): FormArray<FormGroup> { return this.form.get('ministries') as FormArray<FormGroup>; }

  private publicId?: string;

  /** Country name used in the phone validation message. */
  get phoneCountryName(): string {
    return this.form.get('phoneCountry')!.value === 'KR' ? 'Korean' : 'German';
  }

  ngOnInit(): void {
    this.publicId = this.route.snapshot.paramMap.get('publicId') ?? undefined;
    this.isEdit.set(!!this.publicId);

    // Load the training catalog (needed to map the form's type enum to a publicId).
    this.memberService.getTrainingCatalog().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: catalog => this.trainingCatalog.set(catalog),
    });

    // Load the ministry catalog (needed to populate ministry select options).
    this.memberService.getMinistryCatalog()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: c => this.ministryCatalog.set(c) });

    // Load church groups (needed to populate the "Church Group" select options).
    this.memberService.getChurchGroups()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: g => this.churchGroups.set(g) });

    // Re-validate the local number whenever the country changes.
    this.form.get('phoneCountry')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.get('phoneLocal')!.updateValueAndValidity());

    if (this.publicId) {
      this.loading.set(true);
      this.memberService.getMember(this.publicId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: member => {
          this.patchForm(member);
          this.loading.set(false);
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: '오류', detail: '회원 정보를 불러올 수 없습니다.' });
          this.loading.set(false);
        },
      });
    }
  }

  private patchForm(member: Member): void {
    const { country: phoneCountry, local: phoneLocal } = parseE164(member.phoneNumber);
    this.form.patchValue({
      lastName:         member.lastName,
      firstName:        member.firstName,
      discriminator:    member.discriminator ?? '',
      gender:           member.gender,
      baptism:          member.baptism,
      birthDate:        member.birthDate ? new Date(member.birthDate) : null,
      phoneCountry,
      phoneLocal,
      email:            member.email ?? '',
      street:           member.street ?? '',
      houseNumber:      member.houseNumber ?? '',
      zipCode:          member.zipCode ?? '',
      city:             member.city ?? '',
      registrationDate: member.registrationDate ? new Date(member.registrationDate) : null,
      groupPublicId:    member.groupPublicId ?? null,
      memberStatus:     member.memberStatus,
    });

    this.rebuildActivities(member.trainings ?? []);
    this.rebuildMinistries(member.ministries ?? []);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const raw = this.form.getRawValue();
    const phoneNumber = normalizeToE164(raw.phoneCountry as PhoneCountry, raw.phoneLocal ?? '') ?? undefined;

    const trainingItems  = this.collectTrainingItems();
    const ministryItems  = this.collectMinistryItems();
    const toIso = (d: Date | null | undefined) => d ? d.toISOString().split('T')[0] : undefined;

    const isEdit = this.isEdit() && !!this.publicId;
    const successDetail = isEdit ? '저장되었습니다.' : '등록되었습니다.';
    const errorDetail   = isEdit ? '저장에 실패했습니다.' : '등록에 실패했습니다.';

    let member$: Observable<Member>;
    if (isEdit) {
      const req = {
        lastName:         raw.lastName ?? undefined,
        firstName:        raw.firstName ?? undefined,
        discriminator:    raw.discriminator || undefined,
        gender:           (raw.gender as Gender) ?? undefined,
        baptism:          (raw.baptism as Baptism) ?? undefined,
        birthDate:        toIso(raw.birthDate),
        phoneNumber,
        email:            raw.email || undefined,
        street:           raw.street || undefined,
        houseNumber:      raw.houseNumber || undefined,
        zipCode:          raw.zipCode || undefined,
        city:             raw.city || undefined,
        registrationDate: toIso(raw.registrationDate),
        // Always send the group: a chosen publicId assigns it, a blank string
        // clears it (backend treats "" as "remove the group"). Omitting it would
        // leave the existing group untouched, so a cleared select must send "".
        groupPublicId:    raw.groupPublicId ?? '',
        memberStatus:     (raw.memberStatus as MemberStatus) ?? undefined,
      };
      member$ = this.memberService.updateMember(this.publicId!, req);
    } else {
      const req = {
        lastName:         raw.lastName!,
        firstName:        raw.firstName!,
        gender:           (raw.gender as Gender) ?? undefined,
        baptism:          (raw.baptism as Baptism) ?? undefined,
        birthDate:        toIso(raw.birthDate),
        phoneNumber,
        email:            raw.email || undefined,
        street:           raw.street || undefined,
        houseNumber:      raw.houseNumber || undefined,
        zipCode:          raw.zipCode || undefined,
        city:             raw.city || undefined,
        registrationDate: toIso(raw.registrationDate),
      };
      member$ = this.memberService.createMember(req);
    }

    // Persist the member, then replace its training and ministry sets with what the form holds.
    member$
      .pipe(
        switchMap(member => this.persistTrainings(member, trainingItems)),
        switchMap(member => this.persistMinistries(member, ministryItems)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: saved => {
          this.messageService.add({ severity: 'success', summary: '완료', detail: successDetail });
          this.saving.set(false);
          setTimeout(() => this.router.navigate(['/members', saved.publicId]), 800);
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: '오류', detail: errorDetail });
          this.saving.set(false);
        },
      });
  }

  /**
   * Replaces the member's training set. Skipped when the catalog never loaded — sending
   * an empty list would otherwise wipe existing trainings.
   */
  private persistTrainings(member: Member, items: MemberTrainingItem[]): Observable<Member> {
    if (this.trainingCatalog().length === 0) return of(member);
    return this.memberService.replaceMemberTrainings(member.publicId, items);
  }

  // --- Training cards (max 3, each type once) ---

  addTraining(): void {
    if (this.trainings.length >= this.maxTrainings) return;
    this.trainings.push(this.newTrainingGroup());
  }

  removeTraining(index: number): void {
    this.trainings.removeAt(index);
  }

  /** Training options for a row, excluding types chosen in other rows (keeps this row's own). */
  availableTrainingOptions(index: number) {
    const taken = this.trainings.controls
      .filter((_, i) => i !== index)
      .map(c => c.get('type')!.value as TrainingType | null);
    return this.trainingTypeOptions.filter(o => !taken.includes(o.value));
  }

  /** Toggles "In progress": when set, clear + disable the completion month/year. */
  onTrainingInProgressChange(index: number): void {
    const group = this.trainings.at(index);
    const inProgress = group.get('inProgress')!.value;
    const month = group.get('month')!;
    const year  = group.get('year')!;
    if (inProgress) {
      month.reset(null);
      year.reset(null);
      month.disable();
      year.disable();
    } else {
      month.enable();
      year.enable();
    }
  }

  private newTrainingGroup(value?: TrainingFormValue): FormGroup {
    const inProgress = value?.status === 'IN_PROGRESS';
    const group = this.fb.group({
      type:       [value?.type ?? null as TrainingType | null, Validators.required],
      month:      [value?.month ?? null as number | null],
      year:       [value?.year ?? null as number | null],
      inProgress: [inProgress],
    });
    if (inProgress) {
      group.get('month')!.disable();
      group.get('year')!.disable();
    }
    return group;
  }

  // --- Persistence seam (model <-> form) ---

  /**
   * Maps the training form rows to backend request items, dropping incomplete cards
   * (no type, or a completed card missing month/year) and any type absent from the catalog.
   */
  private collectTrainingItems(): MemberTrainingItem[] {
    return this.trainings.controls
      .map(c => c.getRawValue())
      .filter(v => v.type && (v.inProgress || (v.month && v.year)))
      .map(v => ({
        type:   v.type as TrainingType,
        month:  v.inProgress ? null : v.month,
        year:   v.inProgress ? null : v.year,
        status: v.inProgress ? 'IN_PROGRESS' : 'COMPLETED',
      } as TrainingFormValue))
      .map(v => mapFormValueToItem(v, this.trainingCatalog()))
      .filter((i): i is MemberTrainingItem => i !== null);
  }

  /** Repopulates the training form array from the member's persisted trainings. */
  private rebuildActivities(trainings: UserTraining[] = []): void {
    this.trainings.clear();
    trainings
      .slice(0, this.maxTrainings)
      .map(mapUserTrainingToFormValue)
      .filter((v): v is TrainingFormValue => v !== null)
      .forEach(v => this.trainings.push(this.newTrainingGroup(v)));
  }

  // --- Ministry cards ---

  addMinistry(): void { this.ministries.push(this.newMinistryGroup()); }
  removeMinistry(index: number): void { this.ministries.removeAt(index); }

  onMinistryOngoingChange(index: number): void {
    const g = this.ministries.at(index);
    const ongoing = g.get('ongoing')!.value;
    const em = g.get('endMonth')!, ey = g.get('endYear')!;
    if (ongoing) { em.reset(null); ey.reset(null); em.disable(); ey.disable(); }
    else { em.enable(); ey.enable(); }
  }

  private newMinistryGroup(value?: MinistryFormValue): FormGroup {
    const ongoing = value?.ongoing ?? true;
    const group = this.fb.group({
      ministryPublicId: [value?.ministryPublicId ?? null as string | null, Validators.required],
      startMonth: [value?.startMonth ?? null as number | null, Validators.required],
      startYear:  [value?.startYear  ?? null as number | null, Validators.required],
      endMonth:   [value?.endMonth   ?? null as number | null],
      endYear:    [value?.endYear    ?? null as number | null],
      ongoing:    [ongoing],
      note:       [value?.note       ?? null as string | null],
    });
    if (ongoing) { group.get('endMonth')!.disable(); group.get('endYear')!.disable(); }
    return group;
  }

  private collectMinistryItems(): MemberMinistryItem[] {
    return this.ministries.controls
      .map(c => c.getRawValue())
      // A finished (not ongoing) assignment must have an end month+year, otherwise it
      // would be indistinguishable from an active one. Such incomplete cards are dropped.
      .filter(v => v.ministryPublicId && v.startMonth && v.startYear && (v.ongoing || (v.endMonth && v.endYear)))
      .map(v => ({
        ministryPublicId: v.ministryPublicId as string,
        startDate: monthYearToFirstOfMonth(v.startMonth, v.startYear)!,
        endDate: v.ongoing ? null : monthYearToFirstOfMonth(v.endMonth, v.endYear),
        note: (v.note as string | null)?.trim() || null,
      }));
  }

  private rebuildMinistries(ministries: MinistryHistory[] = []): void {
    this.ministries.clear();
    ministries.forEach(m => {
      const s = firstOfMonthToMonthYear(m.startDate);
      const e = firstOfMonthToMonthYear(m.endDate);
      this.ministries.push(this.newMinistryGroup({
        ministryPublicId: m.ministryPublicId,
        startMonth: s.month, startYear: s.year,
        endMonth: e.month, endYear: e.year,
        ongoing: m.endDate === null,
        note: m.note,
      }));
    });
  }

  private persistMinistries(member: Member, items: MemberMinistryItem[]): Observable<Member> {
    // Unlike trainings, ministry items carry their own ministryPublicId from the form,
    // so they don't depend on the catalog being loaded — always persist what the form holds.
    return this.memberService.replaceMemberMinistries(member.publicId, items);
  }

  goBack(): void {
    if (this.publicId) {
      this.router.navigate(['/members', this.publicId]);
    } else {
      this.router.navigate(['/members']);
    }
  }
}
