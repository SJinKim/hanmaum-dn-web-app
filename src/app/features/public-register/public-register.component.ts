import { Component, DestroyRef, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
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
import { CheckboxModule } from 'primeng/checkbox';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { EmptyStateComponent } from '../../core/ui/empty-state/empty-state.component';
import { SkeletonComponent } from '../../core/ui/skeleton/skeleton.component';
import { SegmentedControlComponent } from '../../core/ui/segmented-control/segmented-control.component';
import { AppLang, injectAppLang } from '../../core/i18n/language';
import { Baptism, Gender } from '../../core/models/member.model';
import { CHURCH_EXPERIENCES, ChurchExperience } from '../../core/models/newcomer.model';
import { localDateToIso } from '../../core/models/member-activity.model';
import { PHONE_COUNTRIES, PhoneCountry, isValidMobile, normalizeToE164 } from '../../core/models/phone.util';
import {
  PublicNewcomerSubmissionRequest,
  VISIT_MOTIVES,
  VisitMotiveId,
} from '../../core/models/public-newcomer-form.model';
import { PublicFormService } from './public-form.service';

const THEME_KEY = 'app-theme';
const GENDERS: readonly Gender[] = ['M', 'F'];
const BAPTISMS: readonly Baptism[] = ['GENERAL_BAPTIZED', 'CONFIRMATION', 'INFANT_BAPTIZED', 'UNBAPTIZED'];

type PageState = 'loading' | 'unavailable' | 'error' | 'form' | 'done';
type SubmitError = 'rateLimited' | 'invalid' | 'generic';

/** Validates the mobile number against the country chosen in the sibling control. */
const mobileValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = (control.value ?? '') as string;
  if (!value.trim()) return null;
  const country = (control.parent?.get('phoneCountry')?.value ?? 'DE') as PhoneCountry;
  return isValidMobile(country, value) ? null : { invalidMobile: true };
};

/** At least one 방문 동기 — the contract requires a non-empty `visitMotives`. */
const anyMotiveValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const values = Object.values((group.value ?? {}) as Record<string, boolean>);
  return values.some(Boolean) ? null : { noMotive: true };
};

function text(value: string | null | undefined): string | undefined {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : undefined;
}

/** `crypto.randomUUID` needs a secure context; a LAN address over http has only `getRandomValues`. */
export function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Figma: 새가족 등록 (공개) — the page a QR code from 새가족 › QR 등록 링크 (#44)
 * opens. No login: the route sits outside the shell, `AuthService.init` skips
 * Keycloak on `/register/…` and the interceptor sends no token.
 *
 * Nothing is written to storage: theme and language are read from what the
 * device already has, and a toggle here lasts only for this visit.
 */
@Component({
  selector: 'app-public-register',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    CheckboxModule,
    DatePickerModule,
    InputTextModule,
    SelectModule,
    TranslatePipe,
    EmptyStateComponent,
    SkeletonComponent,
    SegmentedControlComponent,
  ],
  templateUrl: './public-register.component.html',
})
export class PublicRegisterComponent implements OnInit {
  private readonly service    = inject(PublicFormService);
  private readonly route      = inject(ActivatedRoute);
  private readonly fb         = inject(FormBuilder);
  private readonly translate  = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly lang       = injectAppLang();

  private token = '';
  /** Kept across retries of the same input, so a lost response cannot create a second newcomer. */
  private idempotencyKey: string | null = null;

  readonly state          = signal<PageState>('loading');
  readonly consentVersion = signal('');
  readonly submitting     = signal(false);
  readonly submitError    = signal<SubmitError | null>(null);
  readonly isDark         = signal(this.readInitialTheme());

  readonly phoneCountryOptions = PHONE_COUNTRIES;
  readonly motives = VISIT_MOTIVES;

  readonly form = this.fb.group({
    lastName:         ['', Validators.required],
    firstName:        ['', Validators.required],
    gender:           [null as Gender | null, Validators.required],
    birthDate:        [null as Date | null, Validators.required],
    phoneCountry:     ['DE' as PhoneCountry],
    phoneLocal:       ['', [Validators.required, mobileValidator, Validators.maxLength(50)]],
    kakaoId:          [''],
    email:            ['', Validators.email],
    street:           [''],
    churchExperience: [null as ChurchExperience | null, Validators.required],
    baptism:          [null as Baptism | null, Validators.required],
    previousChurch:   [''],
    motives:          this.fb.group(
      Object.fromEntries(VISIT_MOTIVES.map(m => [m.id, false])) as Record<VisitMotiveId, boolean>,
      { validators: anyMotiveValidator },
    ),
    otherMotive:      [''],
    consentAccepted:  [false, Validators.requiredTrue],
    honeypot:         [''],
  });

  readonly gender = signal('');
  readonly genderOptions = computed(() => this.options('publicRegister.gender', GENDERS));
  readonly churchExperienceOptions = computed(() =>
    this.options('publicRegister.churchExperience', CHURCH_EXPERIENCES));
  readonly baptismOptions = computed(() => this.options('publicRegister.baptism', BAPTISMS));

  get phonePlaceholder(): string {
    return this.form.get('phoneCountry')!.value === 'KR' ? '10 1234 5678' : '151 2345678';
  }

  get otherChecked(): boolean {
    return !!this.form.get('motives.OTHER')!.value;
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    this.applyTheme(this.isDark());

    this.form.get('phoneCountry')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.get('phoneLocal')!.updateValueAndValidity());

    // Different input is a different submission.
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.idempotencyKey = null;
        this.submitError.set(null);
      });

    this.load();
  }

  load(): void {
    if (!this.token) {
      this.state.set('unavailable');
      return;
    }
    this.state.set('loading');
    this.service.getForm(this.token)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: meta => {
          this.consentVersion.set(meta.consentVersion);
          this.state.set('form');
        },
        error: (err: { status?: number }) => {
          this.state.set(err?.status === 404 ? 'unavailable' : 'error');
        },
      });
  }

  onGenderChange(value: string): void {
    this.gender.set(value);
    const ctrl = this.form.get('gender')!;
    ctrl.setValue(value as Gender);
    ctrl.markAsTouched();
  }

  isInvalid(name: string): boolean {
    const ctrl = this.form.get(name)!;
    return ctrl.invalid && ctrl.touched;
  }

  submit(): void {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.submitError.set(null);
    this.idempotencyKey ??= newIdempotencyKey();

    this.service.submit(this.token, this.toRequest(), this.idempotencyKey)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.idempotencyKey = null;
          // Nothing of what was entered stays in memory once it is sent.
          this.form.reset(undefined, { emitEvent: false });
          this.state.set('done');
        },
        error: (err: { status?: number }) => {
          this.submitting.set(false);
          if (err?.status === 404) {
            this.state.set('unavailable');
          } else {
            this.submitError.set(
              err?.status === 429 ? 'rateLimited' : err?.status === 400 ? 'invalid' : 'generic');
          }
        },
      });
  }

  toggleTheme(): void {
    const next = !this.isDark();
    this.isDark.set(next);
    this.applyTheme(next);
  }

  toggleLang(): void {
    const next: AppLang = this.lang() === 'ko' ? 'en' : 'ko';
    this.translate.use(next);
    if (isPlatformBrowser(this.platformId)) document.documentElement.lang = next;
  }

  private toRequest(): PublicNewcomerSubmissionRequest {
    const v = this.form.getRawValue();
    const checked = VISIT_MOTIVES.filter(m => v.motives[m.id]);
    const other = text(v.otherMotive);
    return {
      lastName:         v.lastName!.trim(),
      firstName:        v.firstName!.trim(),
      gender:           v.gender ?? undefined,
      birthDate:        localDateToIso(v.birthDate) ?? undefined,
      phoneNumber:      normalizeToE164(v.phoneCountry!, v.phoneLocal ?? '') ?? undefined,
      kakaoId:          text(v.kakaoId),
      email:            text(v.email),
      street:           text(v.street),
      churchExperience: v.churchExperience ?? undefined,
      baptism:          v.baptism ?? undefined,
      previousChurch:   text(v.previousChurch),
      visitMotives:     checked.map(m => (m.id === 'OTHER' && other ? `${m.value}: ${other}` : m.value)),
      consentAccepted:  v.consentAccepted === true,
      honeypot:         v.honeypot ?? '',
    };
  }

  private options<T extends string>(prefix: string, values: readonly T[]): { value: T; label: string }[] {
    // `instant` is not reactive; reading the language makes the labels recompute on a switch.
    this.lang();
    return values.map(value => ({ value, label: this.translate.instant(`${prefix}.${value}`) as string }));
  }

  private applyTheme(dark: boolean): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }

  private readInitialTheme(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    try {
      return localStorage.getItem(THEME_KEY) === 'dark';
    } catch {
      return false;
    }
  }
}
