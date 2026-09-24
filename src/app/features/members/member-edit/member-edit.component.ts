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
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { DatePickerModule } from 'primeng/datepicker';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TabsModule } from 'primeng/tabs';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../core/ui/page-header/page-header.component';
import { SkeletonComponent } from '../../../core/ui/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../../core/ui/empty-state/empty-state.component';
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
  TRAINING_STATUSES,
  TrainingStatus,
  TrainingFormValue,
  TrainingCatalogEntry,
  MemberTrainingItem,
  UserTraining,
  mapUserTrainingToFormValue,
  mapFormValueToItem,
  localDateToIso,
  isoToLocalDate,
  trainingOptions,
  MinistryCatalogEntry,
  MemberMinistryItem,
  MinistryFormValue,
  MinistryHistory,
} from '../../../core/models/member-activity.model';
import { injectAppLang } from '../../../core/i18n/language';
import {
  PHONE_COUNTRIES,
  PhoneCountry,
  isValidMobile,
  normalizeToE164,
  parseE164,
} from '../../../core/models/phone.util';
import { HasUnsavedChanges, UNSAVED_CHANGES_DIALOG_KEY } from '../../../core/guards/unsaved-changes.guard';

const LEADER_DIALOG_KEY = 'leader-change';

/** Read-only 순장 시작일 / 종료일 plus which hint each field shows. */
export interface TenureView {
  startDate: string | null;
  endDate: string | null;
  startHint: 'start' | null;
  endHint: 'end' | 'pendingEnd' | 'past';
  /** Set when the past tenure was in another 순 than the one selected. */
  pastGroupName?: string | null;
}

/** Whether the last Hangul syllable of `word` ends in a final consonant (받침). */
function hasFinalConsonant(word: string): boolean {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
}

/** 을 / 를 for `word`; 을(를) when it does not end in Hangul. */
function objectParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (!(code >= 0 && code <= 11171)) return '을(를)';
  return hasFinalConsonant(word) ? '을' : '를';
}

/** 은 / 는 for `word`; 은(는) when it does not end in Hangul. */
function topicParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (!(code >= 0 && code <= 11171)) return '은(는)';
  return hasFinalConsonant(word) ? '은' : '는';
}

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
    ToggleSwitchModule,
    TabsModule,
    ToastModule,
    ConfirmDialogModule,
    TooltipModule,
    TranslatePipe,
    PageHeaderComponent,
    SkeletonComponent,
    EmptyStateComponent,
  ],
  providers: [MessageService],
  templateUrl: './member-edit.component.html',
})
export class MemberEditComponent implements OnInit, HasUnsavedChanges {
  private readonly memberService = inject(MemberService);
  private readonly route         = inject(ActivatedRoute);
  private readonly router        = inject(Router);
  private readonly fb            = inject(FormBuilder);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef    = inject(DestroyRef);
  private readonly translate     = inject(TranslateService);
  private readonly confirmation  = inject(ConfirmationService);

  /** Key of the dialog the unsaved-changes guard opens; rendered at the end of the template. */
  readonly unsavedChangesDialogKey = UNSAVED_CHANGES_DIALOG_KEY;
  readonly leaderDialogKey = LEADER_DIALOG_KEY;

  readonly isEdit     = signal(false);
  readonly loading    = signal(false);
  readonly saving     = signal(false);

  /**
   * Selected tab of the 청년 정보 card. `p-tabs` binds `value` as a `model()`,
   * so the signal is written directly by the tab strip.
   */
  readonly activeTab = signal(0);

  /** The member being edited — feeds the page header; null while creating. */
  private readonly loaded = signal<Member | null>(null);

  /** Training catalog from the backend — resolves a form row's code to a publicId. */
  private readonly trainingCatalog = signal<TrainingCatalogEntry[]>([]);

  /** Active UI language; course labels and status labels follow it. */
  private readonly lang = injectAppLang();

  /** Selectable courses, in catalog order. A member can hold each course at most once. */
  readonly trainingCourseOptions = computed(() =>
    trainingOptions(this.trainingCatalog(), this.lang()));

  /** Cap on training cards: one per selectable course, no arbitrary limit. */
  readonly maxTrainings = computed(() => this.trainingCourseOptions().length);

  /** The six server-side enrolment statuses, labelled in the active language. */
  readonly trainingStatusOptions = computed(() => {
    // `instant` is not reactive; reading the language makes the labels recompute on a switch.
    this.lang();
    return TRAINING_STATUSES.map(s => ({
      value: s,
      label: this.translate.instant(`members.trainingStatus.${s}`) as string,
    }));
  });

  /** Ministry catalog from the backend — populates the ministry select options. */
  private readonly ministryCatalog = signal<MinistryCatalogEntry[]>([]);
  readonly ministryOptions = computed(() =>
    this.ministryCatalog().map(m => ({ value: m.publicId, label: m.title })));

  /** Church groups from the backend — populates the "Church Group" select. */
  private readonly churchGroups = signal<ChurchGroupSummary[]>([]);
  readonly groupOptions = computed(() =>
    this.churchGroups().map(g => ({
      value: g.publicId,
      label: g.division ? `${g.name} (${g.division})` : g.name,
    })));

  /** Header texts differ between 추가 and 수정; `instant` needs the language read to recompute. */
  readonly pageHeading = computed(() => {
    this.lang();
    const member = this.loaded();
    if (!this.isEdit()) return this.translate.instant('members.edit.createHeading') as string;
    return member ? `${member.lastName}${member.firstName}` : this.translate.instant('members.edit.editHeading') as string;
  });

  readonly pageSubtitle = computed(() => {
    this.lang();
    return this.translate.instant(
      this.isEdit() ? 'members.edit.editSubtitle' : 'members.edit.createSubtitle') as string;
  });

  readonly breadcrumb = computed(() => {
    this.lang();
    return [
      this.translate.instant('members.title') as string,
      this.translate.instant(this.isEdit() ? 'members.actions.edit' : 'members.addButton') as string,
    ];
  });

  readonly phoneCountryOptions = PHONE_COUNTRIES;
  readonly statusOptions       = MEMBER_STATUS_OPTIONS;
  readonly genderOptions       = GENDER_OPTIONS;
  readonly baptismOptions      = BAPTISM_OPTIONS;

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
    registrationDate: [null as Date | null],
    // 직업 is designed but has no backend field yet (hanmaum-dn-server#197), so
    // the control renders disabled and is excluded from every request payload.
    occupation:      [{ value: '', disabled: true }],
    groupPublicId:   [null as string | null],
    memberStatus:    [null as string | null],
    isGroupLeader:   [{ value: false, disabled: true }],
    trainings:       this.fb.array<FormGroup>([]),
    ministries:      this.fb.array<FormGroup>([]),
  });

  /** Name of the sitting 순장 that this save would replace, or null when no hint is needed. */
  readonly leaderChangeHintName = signal<string | null>(null);

  /** Mirrors of the 순 select and the 순장 toggle, so the tenure fields can be computed. */
  private readonly leaderOn = signal(false);
  private readonly selectedGroupId = signal<string | null>(null);

  /**
   * The read-only 순장 시작일 / 종료일 pair under the toggle. The API has no end date
   * for a running tenure, so a pending 해제 shows today — the day the server will record.
   */
  readonly tenure = computed<TenureView>(() => {
    const m = this.loaded();
    const today = localDateToIso(new Date())!;
    const leadsLoadedGroup = !!m?.isGroupLeader;

    if (this.leaderOn()) {
      if (leadsLoadedGroup && this.selectedGroupId() === m?.groupPublicId) {
        return { startDate: m?.groupLeaderSince ?? null, endDate: null, startHint: 'start', endHint: 'end' };
      }
      // A new tenure starts on save, and the server dates it today.
      return { startDate: today, endDate: null, startHint: 'start', endHint: 'end' };
    }
    if (leadsLoadedGroup) {
      return { startDate: m?.groupLeaderSince ?? null, endDate: today, startHint: 'start', endHint: 'pendingEnd' };
    }
    const past = m?.lastGroupLeaderTenure;
    if (past?.endDate) {
      return {
        startDate: past.startDate,
        endDate: past.endDate,
        startHint: null,
        endHint: 'past',
        pastGroupName: past.groupPublicId !== this.selectedGroupId() ? past.groupName : null,
      };
    }
    return { startDate: null, endDate: null, startHint: 'start', endHint: 'end' };
  });

  get trainings(): FormArray<FormGroup> { return this.form.get('trainings') as FormArray<FormGroup>; }
  get ministries(): FormArray<FormGroup> { return this.form.get('ministries') as FormArray<FormGroup>; }

  private publicId?: string;
  private originalIsGroupLeader = false;
  private originalGroupPublicId: string | null = null;
  private leaderPersistError: 'assign' | 'clear' | null = null;
  /** Set while the component itself writes the 순 / 순장 controls, so no dialog opens. */
  private silentLeaderWrite = false;

  /**
   * Only user edits count: `patchValue` while loading never marks the form dirty,
   * and a successful save resets it to pristine before navigating away.
   */
  hasUnsavedChanges(): boolean {
    return this.form.dirty;
  }

  /** Country name used in the phone validation message. */
  get phoneCountryName(): string {
    return this.form.get('phoneCountry')!.value === 'KR' ? 'Korean' : 'German';
  }

  ngOnInit(): void {
    this.publicId = this.route.snapshot.paramMap.get('publicId') ?? undefined;
    this.isEdit.set(!!this.publicId);

    // Load the ministry catalog (needed to populate ministry select options).
    this.memberService.getMinistryCatalog()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: c => this.ministryCatalog.set(c) });

    // Load church groups (needed to populate the "Church Group" select options
    // and to know whether the selected group already has a 순장).
    this.memberService.getChurchGroups()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: g => { this.churchGroups.set(g); this.refreshLeaderHint(); } });

    // Re-validate the local number whenever the country changes.
    this.form.get('phoneCountry')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.get('phoneLocal')!.updateValueAndValidity());

    this.form.get('groupPublicId')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(group => this.onGroupChange(group));

    this.form.get('isGroupLeader')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(checked => this.onLeaderToggle(!!checked));

    if (this.publicId) {
      this.loading.set(true);
      // Catalog and member must arrive together: the member's trainings are resolved
      // through the catalog, so patching the form before it lands would silently drop
      // every training card.
      forkJoin({
        catalog: this.memberService.getTrainingCatalog(),
        member:  this.memberService.getMember(this.publicId),
      }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ({ catalog, member }) => {
          this.trainingCatalog.set(catalog);
          this.patchForm(member);
          this.loading.set(false);
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: '오류', detail: '회원 정보를 불러올 수 없습니다.' });
          this.loading.set(false);
        },
      });
    } else {
      // Create form: only the catalog is needed, to populate the course select.
      this.memberService.getTrainingCatalog()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: catalog => this.trainingCatalog.set(catalog) });
    }
  }

  private patchForm(member: Member): void {
    const { country: phoneCountry, local: phoneLocal } = parseE164(member.phoneNumber);
    this.loaded.set(member);
    this.silentLeaderWrite = true;
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
      registrationDate: isoToLocalDate(member.registrationDate ?? null),
      groupPublicId:    member.groupPublicId ?? null,
      memberStatus:     member.memberStatus,
      isGroupLeader:    !!member.isGroupLeader,
    });
    this.silentLeaderWrite = false;
    this.originalIsGroupLeader = !!member.isGroupLeader;
    this.originalGroupPublicId = member.groupPublicId ?? null;
    this.syncLeaderState();

    this.rebuildActivities(member.trainings ?? []);
    this.rebuildMinistries(member.ministries ?? []);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.leaderPersistError = null;
    const raw = this.form.getRawValue();
    const phoneNumber = normalizeToE164(raw.phoneCountry as PhoneCountry, raw.phoneLocal ?? '') ?? undefined;

    const trainingItems  = this.collectTrainingItems();
    const ministryItems  = this.collectMinistryItems();
    const toIso = (d: Date | null | undefined) => localDateToIso(d) ?? undefined;
    // Figma splits 등록일 into 연도 + 월; the API wants a date, so the day is the 1st.
    const registrationDate = toIso(raw.registrationDate);

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
        registrationDate,
        // Always send the group: a chosen publicId assigns it, a blank string
        // clears it (backend treats "" as "remove the group"). Omitting it would
        // leave the existing group untouched, so a cleared select must send "".
        groupPublicId:    raw.groupPublicId ?? '',
        memberStatus:     (raw.memberStatus as MemberStatus) ?? undefined,
        // Drop 예비순장 when appointing 순장 — they are no longer "next".
        ...(raw.isGroupLeader ? { isNextGroupLeader: false } : {}),
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
        registrationDate,
      };
      member$ = this.memberService.createMember(req);
    }

    const wantLeader = !!raw.isGroupLeader;
    const newGroup = raw.groupPublicId || null;

    // Persist the member, then replace its training and ministry sets with what the form holds.
    member$
      .pipe(
        switchMap(member => this.persistTrainings(member, trainingItems)),
        switchMap(member => this.persistMinistries(member, ministryItems)),
        switchMap(member => this.persistLeadership(member, wantLeader, newGroup)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: saved => {
          this.messageService.add({ severity: 'success', summary: '완료', detail: successDetail });
          if (this.leaderPersistError === 'assign') {
            this.messageService.add({ severity: 'error', summary: '오류', detail: '순장 지정에 실패했습니다.' });
          } else if (this.leaderPersistError === 'clear') {
            this.messageService.add({ severity: 'error', summary: '오류', detail: '순장 해제에 실패했습니다.' });
          }
          this.saving.set(false);
          // Everything is persisted — leaving now must not trigger the unsaved-changes guard.
          this.form.markAsPristine();
          this.router.navigate(['/members', saved.publicId]);
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: '오류', detail: errorDetail });
          this.saving.set(false);
        },
      });
  }

  /**
   * Appoints or clears 순장 after the member PATCH. The backend requires the member
   * to already belong to the group, so this must run after `updateMember`.
   *
   * A 순장 moved to another 순 needs no clear: the PATCH itself ends the tenure in the
   * old group (`MemberService.endLeadershipIfMovedOutOfGroup` on the server). Only the
   * local group list is updated so the old 순 no longer shows them as leader.
   */
  private persistLeadership(
    member: Member,
    checked: boolean,
    newGroup: string | null,
  ): Observable<Member> {
    if (!this.isEdit()) return of(member);

    const alreadyLeadsThisGroup =
      this.originalIsGroupLeader && newGroup === this.originalGroupPublicId;

    if (this.originalIsGroupLeader && !alreadyLeadsThisGroup) {
      this.churchGroups.update(gs => gs.map(g =>
        g.publicId === this.originalGroupPublicId && g.leaderPublicId === this.publicId
        ? { ...g, leaderPublicId: null, leaderName: null, leaderSince: null }
        : g));
    }

    if (checked && newGroup && !alreadyLeadsThisGroup) {
      return this.memberService.assignGroupLeader(newGroup, member.publicId).pipe(
        map(updated => {
          this.churchGroups.update(gs => gs.map(g => g.publicId === updated.publicId ? updated : g));
          return { ...member, isGroupLeader: true };
        }),
        catchError(() => {
          this.leaderPersistError = 'assign';
          return of(member);
        }),
      );
    }

    const sameGroup = newGroup === this.originalGroupPublicId;
    if (!checked && this.originalIsGroupLeader && sameGroup && this.originalGroupPublicId) {
      return this.memberService.clearGroupLeader(this.originalGroupPublicId).pipe(
        map(updated => {
          this.churchGroups.update(gs => gs.map(g => g.publicId === updated.publicId ? updated : g));
          return { ...member, isGroupLeader: false };
        }),
        catchError(() => {
          this.leaderPersistError = 'clear';
          return of(member);
        }),
      );
    }

    return of(member);
  }

  private syncLeaderCheckboxEnabled(): void {
    const ctrl = this.form.get('isGroupLeader')!;
    if (this.form.get('groupPublicId')!.value) {
      ctrl.enable({ emitEvent: false });
    } else {
      ctrl.setValue(false, { emitEvent: false });
      ctrl.disable({ emitEvent: false });
    }
  }

  /** Re-derives everything that hangs off the 순 select and the 순장 toggle. */
  private syncLeaderState(): void {
    this.syncLeaderCheckboxEnabled();
    this.selectedGroupId.set(this.form.get('groupPublicId')!.value);
    this.leaderOn.set(!!this.form.get('isGroupLeader')!.value);
    this.refreshLeaderHint();
  }

  private writeLeaderControls(values: { groupPublicId?: string | null; isGroupLeader?: boolean }): void {
    this.silentLeaderWrite = true;
    this.form.patchValue(values);
    this.silentLeaderWrite = false;
    this.syncLeaderState();
  }

  /** True when the 순 / 순장 pair is back where it was loaded — undoing needs no dialog. */
  private isOriginalLeaderState(group: string | null, checked: boolean): boolean {
    return group === this.originalGroupPublicId && checked === this.originalIsGroupLeader;
  }

  /**
   * Every 순장 change ends or replaces a tenure, so it waits for 예 in a dialog. The
   * control has already taken the new value when this runs; it is put back first and
   * only re-applied on accept, so 취소 leaves toggle and select untouched.
   */
  private onLeaderToggle(checked: boolean): void {
    if (this.silentLeaderWrite) return;
    const group = this.selectedGroupId();
    if (!group || this.isOriginalLeaderState(group, checked)) {
      this.syncLeaderState();
      return;
    }
    this.writeLeaderControls({ isGroupLeader: !checked });
    const ctrl = this.form.get('isGroupLeader')!;
    if (this.isOriginalLeaderState(group, !checked)) ctrl.markAsPristine();

    this.askLeaderChange(
      checked ? this.assignMessage(group) : this.endMessage(group),
      checked ? 'assign' : 'end',
      () => {
        this.writeLeaderControls({ isGroupLeader: checked });
        ctrl.markAsDirty();
      },
    );
  }

  private onGroupChange(group: string | null): void {
    if (this.silentLeaderWrite) return;
    const previous = this.selectedGroupId();
    const leading = this.leaderOn();
    if (!leading || this.isOriginalLeaderState(group, leading)) {
      this.syncLeaderState();
      return;
    }
    this.writeLeaderControls({ groupPublicId: previous });
    const ctrl = this.form.get('groupPublicId')!;
    if (this.isOriginalLeaderState(previous, leading)) ctrl.markAsPristine();

    // Clearing the 순 of a 순장 ends the tenure; picking another one moves it.
    const moving = !!group;
    this.askLeaderChange(
      moving ? this.moveMessage(previous!, group!) : this.endMessage(previous!),
      moving ? 'move' : 'end',
      () => {
        this.writeLeaderControls(moving ? { groupPublicId: group } : { groupPublicId: null, isGroupLeader: false });
        ctrl.markAsDirty();
      },
    );
  }

  private askLeaderChange(message: string, kind: 'assign' | 'end' | 'move', accept: () => void): void {
    const t = (key: string) => this.translate.instant(`members.edit.leaderDialog.${key}`) as string;
    this.confirmation.confirm({
      key: LEADER_DIALOG_KEY,
      header: t(`${kind}Header`),
      message,
      acceptLabel: t(`${kind}Accept`),
      rejectLabel: t('cancel'),
      accept,
    });
  }

  private assignMessage(groupId: string): string {
    const group = this.groupById(groupId);
    const name = this.memberName();
    return [
      this.dialogText('assign', { name, obj: objectParticle(name), group: group?.name ?? '' }),
      this.replacedLeaderText('replace', group),
    ].filter(Boolean).join(' ');
  }

  private endMessage(groupId: string): string {
    const today = localDateToIso(new Date())!;
    return this.dialogText('end', { name: this.memberName(), group: this.groupById(groupId)?.name ?? '', today });
  }

  private moveMessage(fromId: string, toId: string): string {
    const to = this.groupById(toId);
    const name = this.memberName();
    // Only a tenure that already exists in the old 순 is ended by the move.
    const endsOld = this.originalIsGroupLeader && fromId === this.originalGroupPublicId;
    return [
      this.dialogText('move', { name, obj: objectParticle(name), group: to?.name ?? '' }),
      endsOld ? this.dialogText('moveEndsOld', { group: this.groupById(fromId)?.name ?? '' }) : '',
      this.replacedLeaderText('moveReplace', to),
    ].filter(Boolean).join(' ');
  }

  /** Sentence naming the sitting 순장 the change would end — empty when there is none, or it is this member. */
  private replacedLeaderText(key: string, group: ChurchGroupSummary | undefined): string {
    if (!group?.leaderPublicId || group.leaderPublicId === this.publicId) return '';
    const leader = group.leaderName || group.leaderPublicId;
    return this.dialogText(key, {
      group: group.name,
      leader,
      topic: topicParticle(leader),
      since: group.leaderSince ?? '',
    });
  }

  private dialogText(key: string, params: Record<string, string>): string {
    return this.translate.instant(`members.edit.leaderDialog.${key}`, params) as string;
  }

  private groupById(id: string): ChurchGroupSummary | undefined {
    return this.churchGroups().find(g => g.publicId === id);
  }

  private memberName(): string {
    const m = this.loaded();
    const raw = this.form.getRawValue();
    return `${raw.lastName || m?.lastName || ''}${raw.firstName || m?.firstName || ''}`;
  }

  refreshLeaderHint(): void {
    const checked = !!this.form.get('isGroupLeader')!.value;
    const groupId = this.form.get('groupPublicId')!.value;
    if (!checked || !groupId) {
      this.leaderChangeHintName.set(null);
      return;
    }
    const group = this.churchGroups().find(g => g.publicId === groupId);
    const existingId = group?.leaderPublicId;
    if (existingId && existingId !== this.publicId) {
      this.leaderChangeHintName.set(group?.leaderName || existingId);
    } else {
      this.leaderChangeHintName.set(null);
    }
  }

  /**
   * Replaces the member's training set — a destructive PUT, so it runs only when it
   * can't lose data:
   *
   * - the training form must be dirty. A member saved without touching the trainings
   *   sends nothing, so an unrelated edit can never wipe the training history.
   * - the catalog must be loaded. Without it every row fails to resolve to a publicId
   *   and the request would degrade into "replace with nothing".
   */
  private persistTrainings(member: Member, items: MemberTrainingItem[]): Observable<Member> {
    if (!this.trainings.dirty) return of(member);
    if (this.trainingCatalog().length === 0) return of(member);
    return this.memberService.replaceMemberTrainings(member.publicId, items);
  }

  // --- Training cards (one per catalog course) ---

  addTraining(): void {
    if (this.trainings.length >= this.maxTrainings()) return;
    this.trainings.push(this.newTrainingGroup());
    this.trainings.markAsDirty();
  }

  removeTraining(index: number): void {
    this.trainings.removeAt(index);
    this.trainings.markAsDirty();
  }

  /**
   * Course options for a row: the active catalog minus the courses picked in other rows.
   * The row's own course is always kept, so a member holding a retired course can still
   * see and re-save it.
   */
  availableTrainingOptions(index: number): { value: string; label: string }[] {
    const own = (this.trainings.at(index)?.get('code')!.value as string | null) ?? null;
    const taken = this.trainings.controls
      .filter((_, i) => i !== index)
      .map(c => c.get('code')!.value as string | null);
    return trainingOptions(this.trainingCatalog(), this.lang(), own ? [own] : [])
      .filter(o => !taken.includes(o.value));
  }

  /** Only a COMPLETED training carries a completion date; the rest clear it. */
  onTrainingStatusChange(index: number): void {
    const group = this.trainings.at(index);
    const completedAt = group.get('completedAt')!;
    if (group.get('status')!.value === 'COMPLETED') {
      completedAt.enable();
    } else {
      completedAt.reset(null);
      completedAt.disable();
    }
  }

  private newTrainingGroup(value?: TrainingFormValue): FormGroup {
    const status = value?.status ?? 'COMPLETED';
    const group = this.fb.group({
      code:        [value?.code ?? null as string | null, Validators.required],
      completedAt: [value?.completedAt ?? null as Date | null],
      status:      [status as TrainingStatus, Validators.required],
    });
    if (status !== 'COMPLETED') group.get('completedAt')!.disable();
    return group;
  }

  // --- Persistence seam (model <-> form) ---

  /**
   * Maps the training form rows to backend request items, dropping incomplete cards
   * (no course, or a completed card missing its date) and any course absent from the catalog.
   */
  private collectTrainingItems(): MemberTrainingItem[] {
    return this.trainings.controls
      .map(c => c.getRawValue())
      .filter(v => v.code && (v.status !== 'COMPLETED' || v.completedAt))
      .map(v => ({
        code:        v.code as string,
        completedAt: v.status === 'COMPLETED' ? v.completedAt : null,
        status:      v.status as TrainingStatus,
      } as TrainingFormValue))
      .map(v => mapFormValueToItem(v, this.trainingCatalog()))
      .filter((i): i is MemberTrainingItem => i !== null);
  }

  /**
   * Repopulates the training form array from the member's persisted trainings, and
   * resets it to pristine — loading a member is not an edit, and only an edit may
   * trigger the destructive replace in {@link persistTrainings}.
   */
  private rebuildActivities(trainings: UserTraining[] = []): void {
    this.trainings.clear();
    trainings
      .map(t => mapUserTrainingToFormValue(t, this.trainingCatalog()))
      .filter((v): v is TrainingFormValue => v !== null)
      .forEach(v => this.trainings.push(this.newTrainingGroup(v)));
    this.trainings.markAsPristine();
  }

  // --- Ministry cards ---

  addMinistry(): void {
    this.ministries.push(this.newMinistryGroup());
    this.ministries.markAsDirty();
  }

  removeMinistry(index: number): void {
    this.ministries.removeAt(index);
    this.ministries.markAsDirty();
  }

  /**
   * The row has no "laufend" checkbox (Figma 556:27121, DESIGN.md §9.1): an empty
   * 종료일 *is* the ongoing state, so it is sent as `endDate: null`.
   */
  private newMinistryGroup(value?: MinistryFormValue): FormGroup {
    return this.fb.group({
      ministryPublicId: [value?.ministryPublicId ?? null as string | null, Validators.required],
      startDate: [value?.startDate ?? null as Date | null, Validators.required],
      endDate:   [value?.endDate   ?? null as Date | null],
      note:      [value?.note      ?? null as string | null],
    });
  }

  private collectMinistryItems(): MemberMinistryItem[] {
    return this.ministries.controls
      .map(c => c.getRawValue())
      .filter(v => v.ministryPublicId && v.startDate)
      .map(v => ({
        ministryPublicId: v.ministryPublicId as string,
        startDate: localDateToIso(v.startDate)!,
        endDate: localDateToIso(v.endDate),
        note: (v.note as string | null)?.trim() || null,
      }));
  }

  private rebuildMinistries(ministries: MinistryHistory[] = []): void {
    this.ministries.clear();
    ministries.forEach(m => this.ministries.push(this.newMinistryGroup({
      ministryPublicId: m.ministryPublicId,
      startDate: isoToLocalDate(m.startDate),
      endDate: isoToLocalDate(m.endDate),
      note: m.note,
    })));
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
