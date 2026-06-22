# Ministry rename + "맴버 추가" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename ministry wording (사역팀 관리 / 사역 추가) and let an admin/ministry-leader add an existing 맴버 to a ministry's "현재 활동 맴버" list from the ministry detail page via a single backend call.

**Architecture:** A new presentational `MinistryAddMemberDialogComponent` (PrimeNG `p-dialog`) loads the member name list (`GET /v1/members/names`), lets the user pick a 맴버 + start month + note, and POSTs to `/v1/ministries/{publicId}/members`. The backend owns append + dedupe — no client-side read-modify-write. `MinistryDetailComponent` owns the dialog and appends the returned row to its `activeMembers` signal. Two new methods are added to the existing `MinistryService`, calling the member/ministry endpoints through the shared core `ApiService` so the ministry feature stays self-contained (no cross-feature import of `MemberService`).

**Tech Stack:** Angular 21 (standalone, signals), PrimeNG 19 (`p-dialog`, `p-select`, `p-button`, `p-toast`), Reactive Forms, Tailwind, Jasmine/Karma (`ng test`).

## Global Constraints

- All HTTP goes through `core/services/api.service.ts` — never inject `HttpClient` in components/services directly. `ApiService` unwraps `ApiResponse<T>.data`; HTTP errors surface as `HttpErrorResponse` (read `err.status`, `err.error?.message`).
- No cross-feature imports — the ministry feature must not import `MemberService` (features/members). Share only through `core/`.
- Member-facing copy in the touched ministry-detail area uses **맴버** (not 회원). Button label is exactly **`맴버 추가`**.
- Backend contract (final, `hanmaum-dn-ops/api/openapi.yaml`):
  - `GET /api/v1/members/names` → `data: { publicId, fullName, discriminator }[]`.
  - `POST /api/v1/ministries/{publicId}/members` body `{ memberId /*uuid, required*/, startDate?: 'YYYY-MM-DD', note?: ≤500 }` → `data: ActiveMinistryMemberDto`. `409` = already active (message `이 맴버는 이미 활동중입니다.`), `404` = not found.
- Run `ng lint` and `ng test --watch=false --browsers=ChromeHeadless` before the final commit. Both must pass.
- Work on branch `feat/ministry-add-member` (already created off `dev`).

---

### Task 1: Part A — rename ministry list/edit wording

**Files:**
- Modify: `src/app/features/ministry/ministry-list/ministry-list.component.html:4-5`
- Modify: `src/app/features/ministry/ministry-edit/ministry-edit.component.html:4`
- Create: `src/app/features/ministry/ministry-list/ministry-list.component.spec.ts`
- Test: `src/app/features/ministry/ministry-edit/ministry-edit.component.spec.ts` (add one case)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Write the failing ministry-list render test**

Create `src/app/features/ministry/ministry-list/ministry-list.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { MinistryListComponent } from './ministry-list.component';
import { MinistryService } from '../ministry.service';

describe('MinistryListComponent — wording', () => {
  beforeEach(() => {
    const ministryService = jasmine.createSpyObj<MinistryService>(
      'MinistryService',
      ['getMinistries', 'deactivateMinistry'],
    );
    ministryService.getMinistries.and.returnValue(of([]));

    TestBed.configureTestingModule({
      imports: [MinistryListComponent],
      providers: [
        { provide: MinistryService, useValue: ministryService },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
      ],
    });
  });

  it('renders the renamed header and add button', () => {
    const fixture = TestBed.createComponent(MinistryListComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('사역팀 관리');
    expect(text).toContain('사역 추가');
    expect(text).not.toContain('부서 관리');
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include='**/ministry-list.component.spec.ts'`
Expected: FAIL — text still contains `부서 관리`, not `사역팀 관리`.

- [ ] **Step 3: Apply the rename in `ministry-list.component.html`**

Replace lines 4-5:

```html
    <h1 class="text-2xl font-bold text-gray-800">사역팀 관리</h1>
    <p-button label="사역 추가" icon="pi pi-plus" (onClick)="goToCreate()" />
```

- [ ] **Step 4: Apply the rename in `ministry-edit.component.html`**

Line 4 — change only the create-mode label (keep `부서 수정` for edit mode):

```html
    <h1 class="text-2xl font-bold text-gray-800">{{ isEdit ? '부서 수정' : '사역 추가' }}</h1>
```

- [ ] **Step 5: Add a ministry-edit wording assertion**

In `src/app/features/ministry/ministry-edit/ministry-edit.component.spec.ts`, add inside the existing `describe`:

```ts
  it('shows "사역 추가" as the create-mode title', () => {
    fixture.detectChanges();
    expect((fixture.nativeElement.textContent as string)).toContain('사역 추가');
  });
```

- [ ] **Step 6: Run both specs, verify they pass**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include='**/ministry-list.component.spec.ts' --include='**/ministry-edit.component.spec.ts'`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/features/ministry/ministry-list src/app/features/ministry/ministry-edit
git commit -m "feat(ministry): rename 부서 관리/추가 to 사역팀 관리/사역 추가"
```

---

### Task 2: Model types for the add-member contract

**Files:**
- Modify: `src/app/features/ministry/ministry.model.ts` (append)

**Interfaces:**
- Produces:
  - `interface MemberNameDto { publicId: string; fullName: string; discriminator: string | null }`
  - `interface AddMinistryMemberRequest { memberId: string; startDate?: string | null; note?: string | null }`
  - (reuses existing `ActiveMinistryMemberDto` already in this file)

- [ ] **Step 1: Append the two interfaces to `ministry.model.ts`**

At the end of `src/app/features/ministry/ministry.model.ts`:

```ts

/** Lightweight 맴버 entry for the add-member picker (`GET /v1/members/names`). */
export interface MemberNameDto {
  publicId: string;
  fullName: string;
  discriminator: string | null;
}

/** Body for `POST /v1/ministries/{publicId}/members`. */
export interface AddMinistryMemberRequest {
  memberId: string;
  startDate?: string | null;  // 'YYYY-MM-DD'; omit/null ⇒ backend uses current month
  note?: string | null;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/ministry/ministry.model.ts
git commit -m "feat(ministry): add MemberNameDto + AddMinistryMemberRequest types"
```

---

### Task 3: MinistryService — getMemberNames + addMember

**Files:**
- Modify: `src/app/features/ministry/ministry.service.ts`
- Create: `src/app/features/ministry/ministry.service.spec.ts`

**Interfaces:**
- Consumes: `MemberNameDto`, `AddMinistryMemberRequest`, `ActiveMinistryMemberDto` (Task 2 + existing).
- Produces:
  - `MinistryService.getMemberNames(): Observable<MemberNameDto[]>`
  - `MinistryService.addMember(ministryPublicId: string, body: AddMinistryMemberRequest): Observable<ActiveMinistryMemberDto>`

- [ ] **Step 1: Write the failing service test**

Create `src/app/features/ministry/ministry.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { MinistryService } from './ministry.service';
import { MemberNameDto, AddMinistryMemberRequest, ActiveMinistryMemberDto } from './ministry.model';

describe('MinistryService — add member', () => {
  let service: MinistryService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MinistryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getMemberNames() GETs /v1/members/names and unwraps data', () => {
    const names: MemberNameDto[] = [
      { publicId: 'm1', fullName: '김철수', discriminator: 'A' },
    ];
    let received: MemberNameDto[] | undefined;
    service.getMemberNames().subscribe(r => (received = r));

    const req = http.expectOne(r => r.url.endsWith('/v1/members/names'));
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: null, data: names });

    expect(received).toEqual(names);
  });

  it('addMember() POSTs the body to the ministry members endpoint and unwraps data', () => {
    const body: AddMinistryMemberRequest = {
      memberId: 'm1',
      startDate: '2026-06-01',
      note: '신규',
    };
    const dto: ActiveMinistryMemberDto = {
      publicId: 'm1',
      fullName: '김철수',
      startDate: '2026-06-01',
      note: '신규',
      gender: 'M',
    };
    let received: ActiveMinistryMemberDto | undefined;
    service.addMember('ministry-1', body).subscribe(r => (received = r));

    const req = http.expectOne(r => r.url.endsWith('/v1/ministries/ministry-1/members'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ success: true, message: null, data: dto });

    expect(received).toEqual(dto);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include='**/ministry.service.spec.ts'`
Expected: FAIL — `service.getMemberNames is not a function`.

- [ ] **Step 3: Implement the two methods**

In `src/app/features/ministry/ministry.service.ts`, extend the import block and add methods:

```ts
import {
  Ministry,
  MinistrySummary,
  ActiveMinistryMemberDto,
  CreateMinistryRequest,
  UpdateMinistryRequest,
  MemberNameDto,
  AddMinistryMemberRequest,
} from './ministry.model';
```

Add inside the class (after `getActiveMembers`):

```ts
  /** Lightweight 맴버 name list for the add-member picker. Admin or ministry-leader. */
  getMemberNames(): Observable<MemberNameDto[]> {
    return this.api.get<MemberNameDto[]>('/v1/members/names');
  }

  /** Adds an existing 맴버 to this ministry. Backend appends + dedupes (409 if already active). */
  addMember(
    ministryPublicId: string,
    body: AddMinistryMemberRequest,
  ): Observable<ActiveMinistryMemberDto> {
    return this.api.post<ActiveMinistryMemberDto>(
      `/v1/ministries/${ministryPublicId}/members`,
      body,
    );
  }
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include='**/ministry.service.spec.ts'`
Expected: PASS (2 specs).

- [ ] **Step 5: Commit**

```bash
git add src/app/features/ministry/ministry.service.ts src/app/features/ministry/ministry.service.spec.ts
git commit -m "feat(ministry): service methods for member names + add member"
```

---

### Task 4: MinistryAddMemberDialogComponent

**Files:**
- Create: `src/app/features/ministry/ministry-detail/ministry-add-member-dialog.component.ts`
- Create: `src/app/features/ministry/ministry-detail/ministry-add-member-dialog.component.html`
- Create: `src/app/features/ministry/ministry-detail/ministry-add-member-dialog.component.spec.ts`

**Interfaces:**
- Consumes: `MinistryService.getMemberNames`, `MinistryService.addMember` (Task 3); `MemberNameDto`, `AddMinistryMemberRequest`, `ActiveMinistryMemberDto` (Task 2); `MONTH_OPTIONS`, `YEAR_OPTIONS`, `monthYearToFirstOfMonth` from `core/models/member-activity.model`.
- Produces (used by Task 5):
  - selector `app-ministry-add-member-dialog`
  - inputs: `visible: boolean` (two-way via `visibleChange`), `ministryPublicId: string`
  - output: `added: EventEmitter<ActiveMinistryMemberDto>`
  - public method `memberLabel(dto: MemberNameDto): string`

- [ ] **Step 1: Write the failing dialog spec**

Create `src/app/features/ministry/ministry-detail/ministry-add-member-dialog.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { MinistryAddMemberDialogComponent } from './ministry-add-member-dialog.component';
import { MinistryService } from '../ministry.service';
import { MemberNameDto, ActiveMinistryMemberDto } from '../ministry.model';

describe('MinistryAddMemberDialogComponent', () => {
  let service: jasmine.SpyObj<MinistryService>;

  function makeComponent() {
    const fixture = TestBed.createComponent(MinistryAddMemberDialogComponent);
    fixture.componentRef.setInput('ministryPublicId', 'ministry-1');
    fixture.componentRef.setInput('visible', true);
    return fixture;
  }

  beforeEach(() => {
    service = jasmine.createSpyObj<MinistryService>('MinistryService', ['getMemberNames', 'addMember']);
    service.getMemberNames.and.returnValue(of([]));
    TestBed.configureTestingModule({
      imports: [MinistryAddMemberDialogComponent],
      providers: [{ provide: MinistryService, useValue: service }],
    });
  });

  it('memberLabel() appends the discriminator only when present', () => {
    const c = makeComponent().componentInstance;
    expect(c.memberLabel({ publicId: 'a', fullName: '김철수', discriminator: 'A' })).toBe('김철수 A');
    expect(c.memberLabel({ publicId: 'b', fullName: '이영희', discriminator: null })).toBe('이영희');
  });

  it('submit() posts the selected member with a first-of-month startDate and emits added', () => {
    const dto: ActiveMinistryMemberDto = {
      publicId: 'm1', fullName: '김철수', startDate: '2026-06-01', note: null, gender: 'M',
    };
    service.addMember.and.returnValue(of(dto));

    const fixture = makeComponent();
    const c = fixture.componentInstance;
    const emitted: ActiveMinistryMemberDto[] = [];
    c.added.subscribe(d => emitted.push(d));

    c.form.patchValue({ memberId: 'm1', startYear: 2026, startMonth: 6, note: '  ' });
    c.submit();

    expect(service.addMember).toHaveBeenCalledWith('ministry-1', {
      memberId: 'm1', startDate: '2026-06-01', note: null,
    });
    expect(emitted).toEqual([dto]);
    expect(c.visible()).toBeFalse();
  });

  it('submit() on 409 keeps the dialog open and does not emit', () => {
    service.addMember.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { message: '이 맴버는 이미 활동중입니다.' } })),
    );
    const fixture = makeComponent();
    const c = fixture.componentInstance;
    const emitted: ActiveMinistryMemberDto[] = [];
    c.added.subscribe(d => emitted.push(d));

    c.form.patchValue({ memberId: 'm1', startYear: 2026, startMonth: 6 });
    c.submit();

    expect(emitted).toEqual([]);
    expect(c.visible()).toBeTrue();
    expect(c.saving()).toBeFalse();
  });
});
```

- [ ] **Step 2: Run the spec, verify it fails**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include='**/ministry-add-member-dialog.component.spec.ts'`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Create the component class**

Create `src/app/features/ministry/ministry-detail/ministry-add-member-dialog.component.ts`:

```ts
import {
  Component, DestroyRef, EventEmitter, OnInit, Output,
  inject, input, model, signal, computed,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { MinistryService } from '../ministry.service';
import { MemberNameDto, ActiveMinistryMemberDto, AddMinistryMemberRequest } from '../ministry.model';
import { MONTH_OPTIONS, YEAR_OPTIONS, monthYearToFirstOfMonth } from '../../../core/models/member-activity.model';

@Component({
  selector: 'app-ministry-add-member-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    DialogModule, ButtonModule, SelectModule, InputTextModule, ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './ministry-add-member-dialog.component.html',
})
export class MinistryAddMemberDialogComponent implements OnInit {
  private readonly ministryService = inject(MinistryService);
  private readonly fb              = inject(FormBuilder);
  private readonly messageService  = inject(MessageService);
  private readonly destroyRef      = inject(DestroyRef);

  /** Two-way: parent controls open/close via [(visible)]. */
  readonly visible = model<boolean>(false);
  readonly ministryPublicId = input.required<string>();
  @Output() readonly added = new EventEmitter<ActiveMinistryMemberDto>();

  readonly saving = signal(false);
  private readonly memberNames = signal<MemberNameDto[]>([]);
  readonly memberOptions = computed(() =>
    this.memberNames().map(m => ({ value: m.publicId, label: this.memberLabel(m) })));

  readonly monthOptions = MONTH_OPTIONS;
  readonly yearOptions  = YEAR_OPTIONS;

  private readonly now = new Date();
  readonly form = this.fb.group({
    memberId:   [null as string | null, Validators.required],
    startYear:  [this.now.getFullYear() as number | null, Validators.required],
    startMonth: [(this.now.getMonth() + 1) as number | null, Validators.required],
    note:       ['' as string | null],
  });

  ngOnInit(): void {
    this.ministryService.getMemberNames()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: names => this.memberNames.set(names),
        error: () => this.messageService.add({
          severity: 'error', summary: '오류', detail: '맴버 목록을 불러올 수 없습니다.',
        }),
      });
  }

  /** "김철수 A" when a discriminator distinguishes same-named 맴버, else "김철수". */
  memberLabel(dto: MemberNameDto): string {
    return dto.discriminator ? `${dto.fullName} ${dto.discriminator}` : dto.fullName;
  }

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const raw = this.form.getRawValue();
    const body: AddMinistryMemberRequest = {
      memberId:  raw.memberId!,
      startDate: monthYearToFirstOfMonth(raw.startMonth, raw.startYear),
      note:      raw.note?.trim() || null,
    };
    this.saving.set(true);
    this.ministryService.addMember(this.ministryPublicId(), body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: dto => {
          this.saving.set(false);
          this.added.emit(dto);
          this.messageService.add({ severity: 'success', summary: '완료', detail: '추가되었습니다.' });
          this.close();
        },
        error: (err: HttpErrorResponse) => {
          this.saving.set(false);
          if (err.status === 409) {
            this.messageService.add({
              severity: 'info', summary: '알림',
              detail: err.error?.message ?? '이 맴버는 이미 활동중입니다.',
            });
          } else {
            this.messageService.add({ severity: 'error', summary: '오류', detail: '추가에 실패했습니다.' });
          }
        },
      });
  }

  close(): void {
    this.form.reset({
      memberId: null,
      startYear: this.now.getFullYear(),
      startMonth: this.now.getMonth() + 1,
      note: '',
    });
    this.visible.set(false);
  }
}
```

- [ ] **Step 4: Create the component template**

Create `src/app/features/ministry/ministry-detail/ministry-add-member-dialog.component.html`:

```html
<p-dialog
  header="맴버 추가"
  [visible]="visible()"
  (visibleChange)="visible.set($event)"
  [modal]="true"
  [style]="{ width: '28rem' }"
  [draggable]="false"
  [resizable]="false"
>
  <form [formGroup]="form" class="flex flex-col gap-4 pt-2">
    <div class="flex flex-col gap-1">
      <label class="text-sm font-medium text-gray-700">맴버</label>
      <p-select
        formControlName="memberId"
        [options]="memberOptions()"
        optionLabel="label"
        optionValue="value"
        [filter]="true"
        filterBy="label"
        placeholder="맴버 선택"
        class="w-full"
      />
    </div>

    <div class="flex flex-col gap-1">
      <label class="text-sm font-medium text-gray-700">시작일</label>
      <div class="flex gap-2">
        <p-select formControlName="startYear" [options]="yearOptions" optionLabel="label" optionValue="value" placeholder="YY" class="w-20" />
        <p-select formControlName="startMonth" [options]="monthOptions" optionLabel="label" optionValue="value" placeholder="MM" class="w-20" />
      </div>
    </div>

    <div class="flex flex-col gap-1">
      <label class="text-sm font-medium text-gray-700">비고</label>
      <input pInputText formControlName="note" maxlength="500" class="w-full" />
    </div>
  </form>

  <ng-template pTemplate="footer">
    <p-button label="취소" severity="secondary" [text]="true" (onClick)="close()" />
    <p-button label="추가" icon="pi pi-plus" [loading]="saving()" (onClick)="submit()" />
  </ng-template>
</p-dialog>

<p-toast />
```

- [ ] **Step 5: Run the spec, verify it passes**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include='**/ministry-add-member-dialog.component.spec.ts'`
Expected: PASS (3 specs).

- [ ] **Step 6: Commit**

```bash
git add src/app/features/ministry/ministry-detail/ministry-add-member-dialog.component.*
git commit -m "feat(ministry): add-member dialog component"
```

---

### Task 5: Wire dialog into MinistryDetailComponent + 맴버 copy

**Files:**
- Modify: `src/app/features/ministry/ministry-detail/ministry-detail.component.ts`
- Modify: `src/app/features/ministry/ministry-detail/ministry-detail.component.html`
- Modify: `src/app/features/ministry/ministry-detail/ministry-detail.component.spec.ts`

**Interfaces:**
- Consumes: `MinistryAddMemberDialogComponent` (Task 4); `ActiveMinistryMemberDto` (existing).
- Produces: nothing downstream.

- [ ] **Step 1: Extend the detail spec (failing)**

The existing spec's `MinistryService` spy must now also stub `getMemberNames` (the embedded dialog calls it on init). Update the spy creation line and add cases.

In `src/app/features/ministry/ministry-detail/ministry-detail.component.spec.ts`, change the spy setup:

```ts
    const ministryService = jasmine.createSpyObj<MinistryService>(
      'MinistryService',
      ['getMinistry', 'getActiveMembers', 'getMemberNames', 'addMember'],
    );
    ministryService.getMinistry.and.returnValue(of(ministry));
    ministryService.getActiveMembers.and.returnValue(of([]));
    ministryService.getMemberNames.and.returnValue(of([]));
```

Add these cases at the end of the `describe`:

```ts
  it('uses 맴버 wording for the active-members section', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('현재 활동 맴버');
    expect(text).toContain('맴버 추가');
    expect(text).not.toContain('현재 활동 회원');
  });

  it('onMemberAdded() appends the returned row to the active members table', () => {
    const component = fixture.componentInstance;
    component.onMemberAdded({
      publicId: 'm9', fullName: '박지성', startDate: '2026-06-01', note: null, gender: 'M',
    });
    fixture.detectChanges();
    expect(component.activeMembers().length).toBe(1);
    expect((fixture.nativeElement.textContent as string)).toContain('박지성');
  });
```

- [ ] **Step 2: Run the spec, verify it fails**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include='**/ministry-detail.component.spec.ts'`
Expected: FAIL — text lacks `현재 활동 맴버`; `onMemberAdded` undefined.

- [ ] **Step 3: Update the detail component class**

In `src/app/features/ministry/ministry-detail/ministry-detail.component.ts`:

Add the import:

```ts
import { MinistryAddMemberDialogComponent } from './ministry-add-member-dialog.component';
```

Add `MinistryAddMemberDialogComponent` to the `imports` array of the `@Component` decorator.

Add a signal next to the other signals:

```ts
  addDialogVisible = signal(false);
```

Add two methods (next to `goToMember`):

```ts
  openAddMember(): void { this.addDialogVisible.set(true); }

  onMemberAdded(member: ActiveMinistryMemberDto): void {
    this.activeMembers.update(list => [...list, member]);
  }
```

- [ ] **Step 4: Update the detail template**

In `src/app/features/ministry/ministry-detail/ministry-detail.component.html`:

Replace line 103 (the heading) with a heading + button row:

```html
    <!-- Active members -->
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-gray-700">현재 활동 맴버</h2>
      <p-button label="맴버 추가" icon="pi pi-plus" (onClick)="openAddMember()" />
    </div>
```

Change the column header (was `회원명`):

```html
          <th>맴버명</th>
```

Change the empty message text (was `현재 활동 중인 회원이 없습니다.`):

```html
            현재 활동 중인 맴버가 없습니다.
```

Add the dialog just before the closing `</div>` of the page wrapper / before `<p-toast />` at the end:

```html
  <app-ministry-add-member-dialog
    [(visible)]="addDialogVisible"
    [ministryPublicId]="ministry()!.publicId"
    (added)="onMemberAdded($event)"
  />
```

Note: place this inside the `@else if (ministry())` block (so `ministry()!.publicId` is safe), after the active-members `<p-table>`.

- [ ] **Step 5: Run the spec, verify it passes**

Run: `npx ng test --watch=false --browsers=ChromeHeadless --include='**/ministry-detail.component.spec.ts'`
Expected: PASS.

- [ ] **Step 6: Full lint + test gate**

Run: `npx ng lint && npx ng test --watch=false --browsers=ChromeHeadless`
Expected: lint clean; all specs pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/features/ministry/ministry-detail
git commit -m "feat(ministry): wire 맴버 추가 dialog into ministry detail"
```

---

## Manual verification (after Task 5)

1. `npx ng serve` with the dev proxy pointed at a backend that has server PR #89 (staging until prod promotion).
2. Open a ministry detail → click **맴버 추가** → pick a 맴버, set 시작일, optional 비고 → **추가**.
3. Confirm the row appears immediately in "현재 활동 맴버".
4. Add the same 맴버 again → expect the info toast `이 맴버는 이미 활동중입니다.` and no duplicate row.
5. Open that 맴버's detail page → confirm the ministry now appears in their ministry history.

---

## Self-review notes

- **Spec coverage:** Part A rename → Task 1; model types → Task 2; service methods → Task 3; dialog (picker, startDate, note, 409/404) → Task 4; button + wiring + 맴버 copy (heading/column/empty) → Task 5. All spec sections covered.
- **Type consistency:** `getMemberNames`/`addMember` signatures match across Tasks 3–5; `MemberNameDto`/`AddMinistryMemberRequest`/`ActiveMinistryMemberDto` consistent; `memberLabel`, `onMemberAdded`, `addDialogVisible`, `visible` (model), `ministryPublicId` (input) names match between dialog and detail.
- **No placeholders:** every code/test step contains full content.
- **Contract precondition:** runtime live on staging first — manual test must target a backend with server PR #89 deployed.
