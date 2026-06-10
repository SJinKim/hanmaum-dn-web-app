# Ministry 팀장 Label & Searchable Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the "리더" label to "팀장" on the ministry detail page and replace the raw `publicId` text input in the ministry edit form with a searchable `p-select` dropdown backed by all registered members.

**Architecture:** Two isolated changes — a one-line string change in the detail template, and a component-level addition in the edit form (inject `MemberService`, load members on init, swap input for `p-select`). The existing `form.leaderPublicId` binding and save logic is preserved, with a minor type widening to `string | null` to handle the cleared state from `p-select`.

**Tech Stack:** Angular 17 (standalone components, signals), PrimeNG `p-select` with `[filter]="true"`, `MemberService.getMembers()`.

---

## Files

| File | Change |
|------|--------|
| `src/app/features/ministry/ministry-detail/ministry-detail.component.html` | Modify line 34: "리더" → "팀장" |
| `src/app/features/ministry/ministry-edit/ministry-edit.component.ts` | Add `SelectModule` import, inject `MemberService`, add `memberOptions` signal, load members in `ngOnInit`, widen `leaderPublicId` type to `string \| null` |
| `src/app/features/ministry/ministry-edit/ministry-edit.component.html` | Replace leader plain-text input block with `p-select` |

---

### Task 1: Rename "리더" → "팀장" in the detail page

**Files:**
- Modify: `src/app/features/ministry/ministry-detail/ministry-detail.component.html:34`

- [ ] **Step 1: Make the label change**

In `src/app/features/ministry/ministry-detail/ministry-detail.component.html`, change line 34 from:

```html
          <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">리더</p>
```

to:

```html
          <p class="text-xs text-gray-400 uppercase tracking-wide mb-1">팀장</p>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/ministry/ministry-detail/ministry-detail.component.html
git commit -m "feat(ministry): rename 리더 label to 팀장 on detail page"
```

---

### Task 2: Update the edit component to load members

**Files:**
- Modify: `src/app/features/ministry/ministry-edit/ministry-edit.component.ts`

- [ ] **Step 1: Replace the entire component file with the updated version**

Replace `src/app/features/ministry/ministry-edit/ministry-edit.component.ts` with:

```ts
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { MinistryService } from '../ministry.service';
import { Ministry } from '../ministry.model';
import { MemberService } from '../../members/member.service';

@Component({
  selector: 'app-ministry-edit',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    CheckboxModule,
    SelectModule,
    ToastModule,
    ProgressSpinnerModule,
  ],
  providers: [MessageService],
  templateUrl: './ministry-edit.component.html',
})
export class MinistryEditComponent implements OnInit {
  private readonly ministryService = inject(MinistryService);
  private readonly memberService   = inject(MemberService);
  private readonly route           = inject(ActivatedRoute);
  private readonly router          = inject(Router);
  private readonly messageService  = inject(MessageService);
  private readonly destroyRef      = inject(DestroyRef);

  isEdit   = false;
  loading  = signal(false);
  saving   = signal(false);

  memberOptions = signal<{ value: string; label: string }[]>([]);

  form = {
    name:             '',
    shortDescription: '',
    longDescription:  '',
    imageUrl:         '',
    leaderPublicId:   null as string | null,
    isActive:         true,
  };

  private publicId = '';

  ngOnInit(): void {
    this.publicId = this.route.snapshot.paramMap.get('publicId') ?? '';
    this.isEdit   = !!this.publicId;

    this.memberService.getMembers({ size: 500 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => {
          this.memberOptions.set(
            page.content.map(m => ({ value: m.publicId, label: `${m.lastName}${m.firstName}` }))
          );
        },
      });

    if (this.isEdit) {
      this.loading.set(true);
      this.ministryService.getMinistry(this.publicId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: m => { this.fillForm(m); this.loading.set(false); },
        error: () => {
          this.messageService.add({ severity: 'error', summary: '오류', detail: '부서 정보를 불러올 수 없습니다.' });
          this.loading.set(false);
        },
      });
    }
  }

  private fillForm(m: Ministry): void {
    this.form.name             = m.name;
    this.form.shortDescription = m.shortDescription;
    this.form.longDescription  = m.longDescription ?? '';
    this.form.imageUrl         = m.imageUrl ?? '';
    this.form.leaderPublicId   = m.leader?.publicId ?? null;
    this.form.isActive         = m.isActive;
  }

  save(): void {
    if (!this.form.name.trim() || !this.form.shortDescription.trim()) {
      this.messageService.add({ severity: 'warn', summary: '입력 오류', detail: '부서명과 짧은 설명은 필수입니다.' });
      return;
    }

    this.saving.set(true);

    if (this.isEdit) {
      const req: Record<string, unknown> = {
        name:             this.form.name.trim(),
        shortDescription: this.form.shortDescription.trim(),
        isActive:         this.form.isActive,
      };
      if (this.form.longDescription.trim()) req['longDescription'] = this.form.longDescription.trim();
      if (this.form.imageUrl.trim())        req['imageUrl']        = this.form.imageUrl.trim();
      if (this.form.leaderPublicId)         req['leaderPublicId']  = this.form.leaderPublicId;

      this.ministryService.updateMinistry(this.publicId, req).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.messageService.add({ severity: 'success', summary: '완료', detail: '수정되었습니다.' });
          setTimeout(() => this.router.navigate(['/ministry', this.publicId]), 800);
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: '오류', detail: '수정에 실패했습니다.' });
          this.saving.set(false);
        },
      });
    } else {
      const req: Record<string, unknown> = {
        name:             this.form.name.trim(),
        shortDescription: this.form.shortDescription.trim(),
      };
      if (this.form.longDescription.trim()) req['longDescription'] = this.form.longDescription.trim();
      if (this.form.imageUrl.trim())        req['imageUrl']        = this.form.imageUrl.trim();
      if (this.form.leaderPublicId)         req['leaderPublicId']  = this.form.leaderPublicId;

      this.ministryService.createMinistry(req as never).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: m => {
          this.messageService.add({ severity: 'success', summary: '완료', detail: '부서가 생성되었습니다.' });
          setTimeout(() => this.router.navigate(['/ministry', m.publicId]), 800);
        },
        error: () => {
          this.messageService.add({ severity: 'error', summary: '오류', detail: '생성에 실패했습니다.' });
          this.saving.set(false);
        },
      });
    }
  }

  goBack(): void {
    if (this.isEdit) {
      this.router.navigate(['/ministry', this.publicId]);
    } else {
      this.router.navigate(['/ministry']);
    }
  }
}
```

Key changes from the original:
- Added `SelectModule` to imports array and to the `@Component` `imports`
- Added `MemberService` injection
- Added `memberOptions` signal
- Added member load call in `ngOnInit`
- `form.leaderPublicId` type widened to `string | null`, default changed from `''` to `null`
- `fillForm`: `leaderPublicId` now uses `?? null` instead of `?? ''`
- `save()`: guard changed from `.trim()` to truthiness check (safe for `null`)

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/ministry/ministry-edit/ministry-edit.component.ts
git commit -m "feat(ministry): load member list for 팀장 select in edit form"
```

---

### Task 3: Replace plain-text input with p-select in the edit template

**Files:**
- Modify: `src/app/features/ministry/ministry-edit/ministry-edit.component.html:38-42`

- [ ] **Step 1: Replace the leader input block**

In `src/app/features/ministry/ministry-edit/ministry-edit.component.html`, replace the leader block (lines 38–42):

```html
        <!-- Leader publicId -->
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-gray-700">리더 publicId</label>
          <input pInputText [(ngModel)]="form.leaderPublicId" placeholder="리더 회원 publicId (선택)" />
        </div>
```

with:

```html
        <!-- Team leader select -->
        <div class="flex flex-col gap-1">
          <label class="text-sm font-medium text-gray-700">팀장</label>
          <p-select
            [(ngModel)]="form.leaderPublicId"
            [options]="memberOptions()"
            optionLabel="label"
            optionValue="value"
            [filter]="true"
            filterBy="label"
            [showClear]="true"
            placeholder="팀장 선택 (선택사항)"
            styleClass="w-full"
          />
        </div>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/ministry/ministry-edit/ministry-edit.component.html
git commit -m "feat(ministry): replace 팀장 text input with searchable p-select"
```

---

## Acceptance checklist

- [ ] Ministry detail page shows "팀장" where "리더" was shown
- [ ] Ministry edit form shows a dropdown with member full names (성+이름)
- [ ] Typing in the filter box narrows the list client-side
- [ ] Selecting a member and saving sends the correct `publicId` to the API
- [ ] Clearing the field (× button) and saving sends no `leaderPublicId`
- [ ] Opening an existing ministry in edit mode pre-selects the current 팀장
- [ ] `npx tsc --noEmit` passes
