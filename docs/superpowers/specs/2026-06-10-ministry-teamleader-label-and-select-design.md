# Ministry 팀장 Label & Searchable Select

**Date:** 2026-06-10

## Overview

Two small changes to the ministry feature:
1. Rename the "리더" label to "팀장" on the ministry detail page.
2. Replace the raw `publicId` text input for the team leader field in the ministry edit form with a searchable `p-select` dropdown backed by the full member list.

## Scope

- `ministry-detail.component.html` — label text only
- `ministry-edit.component.ts` — load members, build options signal
- `ministry-edit.component.html` — swap input for `p-select`

Out of scope: server-side search, pagination of member list, any backend changes.

## Changes

### 1. Label rename (detail page)

In `ministry-detail.component.html` line 34, change:
```html
<p class="text-xs text-gray-400 uppercase tracking-wide mb-1">리더</p>
```
to:
```html
<p class="text-xs text-gray-400 uppercase tracking-wide mb-1">팀장</p>
```

### 2. Searchable select (edit form)

**`ministry-edit.component.ts`**

- Add `SelectModule` to the component `imports` array.
- Add a `memberOptions` signal: `signal<{ value: string; label: string }[]>([])`.
- In `ngOnInit`, call `MemberService.getMembers({ size: 500 })` and map the results:
  ```ts
  this.memberService.getMembers({ size: 500 }).subscribe(page => {
    this.memberOptions.set(page.content.map(m => ({ value: m.publicId, label: `${m.lastName}${m.firstName}` })));
  });
  ```
- Existing `form.leaderPublicId` two-way binding is unchanged.

**`ministry-edit.component.html`**

Replace the current label + input block:
```html
<label class="text-sm font-medium text-gray-700">리더 publicId</label>
<input pInputText [(ngModel)]="form.leaderPublicId" placeholder="리더 회원 publicId (선택)" />
```
with:
```html
<label class="text-sm font-medium text-gray-700">팀장</label>
<p-select
  [(ngModel)]="form.leaderPublicId"
  [options]="memberOptions()"
  optionLabel="label"
  optionValue="value"
  [filter]="true"
  filterBy="label"
  placeholder="팀장 선택 (선택사항)"
  [showClear]="true"
  styleClass="w-full"
/>
```

## Data flow

```
ngOnInit
  └─ MemberService.getMembers({ size: 500 })
       └─ maps to memberOptions signal [{ value: publicId, label: fullName }]

p-select (filter=true, filterBy="label")
  └─ admin types → PrimeNG filters memberOptions client-side
  └─ selection writes publicId → form.leaderPublicId
  └─ save() sends leaderPublicId to API unchanged
```

## Acceptance criteria

- Detail page shows "팀장" where "리더" was shown before.
- Edit form shows a dropdown of all member full names.
- Typing in the dropdown filter narrows the list client-side.
- Selecting a member saves the correct `publicId`.
- The field can be cleared (no team leader).
- Existing save/update logic is unaffected.
