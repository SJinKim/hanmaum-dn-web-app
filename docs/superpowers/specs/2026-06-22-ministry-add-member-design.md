# Ministry: rename + "맴버 추가" to active members — Design

> Date: 2026-06-22 · Feature branch (off `dev`): `feat/ministry-add-member`
> Backend contract: `hanmaum-dn-ops/api/openapi.yaml` (ops PR #4, server PR #89 — merged).

## Goal

Two changes to the Ministry feature of the admin dashboard:

1. **Rename** the domain wording in the ministry list/edit screens.
2. **Add an existing 맴버 to a ministry's "현재 활동 맴버" list** directly from the
   ministry detail page, via a single backend call. Because the assignment is the
   same underlying data the member detail reads, the member's detail page reflects
   the new ministry automatically.

Wording: per backend standardization, all member-facing copy in the touched
ministry-detail area uses **맴버** (not 회원).

## Part A — Rename

| File | From | To |
|---|---|---|
| `ministry-list/ministry-list.component.html` (h1) | `부서 관리` | `사역팀 관리` |
| `ministry-list/ministry-list.component.html` (add button) | `부서 추가` | `사역 추가` |
| `ministry-edit/ministry-edit.component.html` (create-mode title) | `부서 추가` | `사역 추가` |

Out of scope (not requested): `부서 상세`, `부서 수정`, `부서가 없습니다.` in other
ministry screens remain unchanged.

## Part B — "맴버 추가" flow

### Backend contract (final, verified in openapi.yaml)

- **Picker source** — `GET /api/v1/members/names`
  - Auth: `admin` or `ministry_leader`.
  - `data: MemberNameDto[]` where `MemberNameDto = { publicId: string; fullName: string; discriminator: string }`.
  - No PII (no email/group) — safe for ministry-leaders. Load once, filter client-side.
- **Add** — `POST /api/v1/ministries/{publicId}/members`
  - Auth: `admin` or `ministry_leader`. `{publicId}` = ministry public UUID.
  - Body `AddMinistryMemberRequest = { memberId: string /*uuid, required*/; startDate?: string /*ISO date, optional*/; note?: string /*≤500, optional*/ }`.
  - `startDate` — any day is normalized server-side to the first of that month; omit ⇒ current month.
  - Success → `data: ActiveMinistryMemberDto = { publicId, fullName, startDate, note, gender }` (note/gender nullable) — the exact row shape the table already renders.
  - `409` → 맴버 already active in this ministry → info toast, no-op. Backend message: `이 맴버는 이미 활동중입니다.`
  - `404` → ministry or 맴버 not found → error toast.

The backend owns append + dedupe. **No client-side read-modify-write, no replace-all,
no dedupe** — one POST per add. (Earlier read-modify-write plan against
`PUT /members/{id}/ministries` is discarded.)

### New model types (`features/ministry/ministry.model.ts`)

```ts
export interface MemberNameDto {
  publicId: string;
  fullName: string;
  discriminator: string | null;
}

export interface AddMinistryMemberRequest {
  memberId: string;
  startDate?: string | null;  // ISO 'YYYY-MM-DD'; omit/null ⇒ current month
  note?: string | null;
}
```

### `MinistryService` — two new methods

Both call the member/ministry endpoints through the shared core `ApiService`, so the
ministry feature stays self-contained (no cross-feature import of `MemberService`,
per the repo's architecture rule).

```ts
getMemberNames(): Observable<MemberNameDto[]>            // GET /v1/members/names
addMember(ministryPublicId: string,
          body: AddMinistryMemberRequest): Observable<ActiveMinistryMemberDto>  // POST /v1/ministries/{id}/members
```

### New component — `MinistryAddMemberDialogComponent`

A presentational `p-dialog` owned by `MinistryDetailComponent`. Inputs/outputs:

- `[visible]` (two-way) — controls open/close.
- `[ministryPublicId]` — the target ministry.
- `(added)` — emits the returned `ActiveMinistryMemberDto` on success.

Form (reuses existing `p-select` + `MONTH_OPTIONS`/`YEAR_OPTIONS` patterns):

```
[맴버 추가]
맴버      p-select [filter]="true" filterBy="label"   ← options from getMemberNames()
           label = discriminator ? `${fullName} ${discriminator}` : fullName
           value = publicId            (required)
시작일    [년 ▾] [월 ▾]                 defaults to current month/year
비고      input (optional, maxlength 500)
                          [취소] [추가]
```

- "Dropdown of all names with a searchbar" = `p-select` with client-side `[filter]`.
  Duplicate names disambiguated by `discriminator`.
- Submit builds `AddMinistryMemberRequest`: `memberId` = selected publicId,
  `startDate` = first-of-month ISO from the year/month selects
  (`monthYearToFirstOfMonth`), `note` = trimmed input or null.
- `addMember` →
  - success: emit `(added)`, toast `완료 / 추가되었습니다.`, reset + close.
  - `err.status === 409`: info toast with `err.error?.message` (`이 맴버는 이미 활동중입니다.`), keep dialog open.
  - else: error toast `추가에 실패했습니다.`

`ApiService` passes HTTP errors through as `HttpErrorResponse`, so the component
branches on `err.status` and reads `err.error.message`.

### `MinistryDetailComponent` wiring

- New signal `addDialogVisible = signal(false)`.
- "맴버 추가" `p-button` (primary, `pi pi-plus`) beside the "현재 활동 맴버" heading
  opens the dialog.
- `(added)` handler appends the returned DTO to `activeMembers()` (no full refetch
  needed — same row shape).

### `ministry-detail.component.html` copy changes (touched area only)

- Heading `현재 활동 회원` → `현재 활동 맴버`.
- Column header `회원명` → `맴버명`.
- Empty message `현재 활동 중인 회원이 없습니다.` → `현재 활동 중인 맴버가 없습니다.`

## Verification

- `ng lint` clean.
- `ng test` (`--watch=false`): unit specs for
  - `MinistryService.addMember` / `getMemberNames` (URL + body, success + 409 paths),
  - `MinistryAddMemberDialogComponent` (label composition with/without discriminator,
    submit payload, 409 info-toast branch).
- Manual demo: open ministry detail → 맴버 추가 → pick a member → 추가 → row appears in
  "현재 활동 맴버"; open that member's detail and confirm the ministry now shows.
  - ⚠️ Runtime is on **staging** first (server PR #89 promoting dev→staging→prod). If
    testing hits prod before promotion, the endpoints 404/unavailable — point the
    dev proxy at staging or wait for prod promotion. Contract is final regardless.

## Out of scope / non-goals

- Creating a brand-new member from this dialog (link-existing only).
- Removing/ending a member's assignment from the ministry page.
- Global 회원→맴버 rename across the rest of the app.
