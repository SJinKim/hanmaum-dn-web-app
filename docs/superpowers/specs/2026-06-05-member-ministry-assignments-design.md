# Member Ministry Assignments — start/end dates

**Date:** 2026-06-05
**Status:** Design approved; ready for implementation plan.
**Supersedes the deferral in:** [2026-06-05-member-ministry-persistence-scope.md](./2026-06-05-member-ministry-persistence-scope.md)
**Spans:** `hanmaum-dn-server` + `hanmaum-dn-web-app`

## TL;DR

The members-list grid needs a working **Ministry** column showing each member's
**currently-active** ministries (zero or more names, rendered as chips). A member's
ministry is modeled as an **assignment** with a **start** and **end** month/year;
an assignment with **no end date is active**.

The previous self-register → admin-approve flow (year-based `registrationPeriod` +
`RegistrationStatus`) **is being abandoned** and is removed by this change. The
existing `ministry_registrations` table is repurposed into the assignment model.
This reverses the post-MVP deferral recorded in the persistence-scope doc, on the
basis that registration is no longer used, so the model had to change regardless.

## Decisions (locked during brainstorming, 2026-06-05)

1. **Model:** real start/end dates (not the year-based registration). Admin-managed.
2. **Granularity:** **month + year**, stored as first-of-month `DATE`s. Matches the
   existing Training editor. An "ongoing" toggle means no end date.
3. **Active predicate:** **`end_date IS NULL`** only. Start date is historical;
   future-dated start/end are *ignored* for the active computation.
4. **Scope of removal:** **full replace** — drop the self-register/approve/withdraw
   endpoints, `RegistrationStatus`, the year-based columns, and the year-based unique
   constraint. No dead/contradictory code left behind.
5. **Edit entry point:** the member edit form, mirroring the Training card editor,
   persisting via a single replace-set endpoint `PUT /members/{id}/ministries`.

## Server (`hanmaum-dn-server`)

### Data model
Repurpose `ministry_registrations` (entity `MinistryRegistration` → **`MinistryAssignment`**):

| Change | Detail |
|---|---|
| **Add** `start_date DATE NOT NULL` | first-of-month, e.g. `2024-03-01` |
| **Add** `end_date DATE NULL` | first-of-month; `NULL` = active/ongoing |
| **Drop** `registration_period` | year string, gone |
| **Drop** `registration_status` | approval flow gone; delete `RegistrationStatus` enum |
| **Drop** unique constraint `uq_ministry_member_period` | a member may have repeat stints in one ministry over time |
| **Keep** `ministry_id`, `member_id`, `note`, soft-delete + `delete_entry_at` | unchanged |

> **Table/entity rename:** the physical table name stays `ministry_registrations`
> (decided); only the JPA entity is renamed to `MinistryAssignment`.

### Flyway migration
One new migration:
1. `ALTER TABLE ... ADD COLUMN start_date DATE`, `ADD COLUMN end_date DATE`.
2. Backfill existing rows: `start_date = (registration_period || '-01-01')::date`,
   `end_date = NULL` (treat legacy rows as ongoing). Then `SET NOT NULL` on `start_date`.
3. `DROP CONSTRAINT uq_ministry_member_period`.
4. `DROP COLUMN registration_period`, `DROP COLUMN registration_status`.

Follows the `db-migrations` skill (naming, idempotency, review).

### API contract changes
Follows the `api-contracts` skill — update the contract doc + both consumers.

**Remove** (dead self-register flow) from `MinistryController`:
- `POST   /ministries/{id}/registrations`
- `GET    /ministries/{id}/registrations`
- `GET    /ministries/{id}/registrations/me`
- `PATCH  /ministries/{id}/registrations/{regId}`
- `DELETE /ministries/{id}/registrations/{regId}`
- DTOs: `CreateRegistrationRequest`, `UpdateRegistrationStatusRequest`, `RegistrationDto`
- `MinistryService` methods: `registerSelf`, `getRegistrations`, `getMyRegistration`,
  `approveOrRejectRegistration`, `withdrawRegistration`.

**Add** (mirror of `PUT /members/{id}/trainings`) on `MemberController`:
- `PUT /members/{publicId}/ministries` — `@PreAuthorize("hasRole('ADMIN')")`.
  Body: `List<MemberMinistryItem>` where
  `MemberMinistryItem = { ministryPublicId: String, startDate: LocalDate, endDate: LocalDate?, note: String? }`.
  Replaces the member's full assignment set (soft-delete removed rows, upsert the rest),
  mirroring `replaceMemberTrainings`. `note` max length 500 (matches the column). Returns
  the updated `MemberDto`.

**Change** DTOs:
- `MemberSummaryDto.activeMinistry: String?` → **`activeMinistries: List<String> = emptyList()`**
  (names of active assignments, deduped, sorted by name).
- `MinistryHistoryDto`: replace `registrationPeriod` + `status` with
  **`startDate: LocalDate`** + **`endDate: LocalDate?`** (keep `ministryPublicId`, `name`,
  and add **`note: String?`**).

### Active-ministries query
Replace `MinistryRegistrationRepository.findApprovedByMemberIds(...)` /
`MemberMinistryView` with:

```
findActiveByMemberIds(memberIds): List<MemberMinistryView(memberId, ministryName)>
  WHERE member.id IN :memberIds AND deletedAt IS NULL AND endDate IS NULL
```

`MemberService.getMembers(...)` groups the rows by `memberId` → `List<String>` for
`activeMinistries`. The per-member history fetch (`findByMemberId`) is reused for the
detail DTO and re-ordered by `startDate DESC`.

### Tests (server)
- Repository: `findActiveByMemberIds` returns only `end_date IS NULL`, non-deleted rows.
- Service: `replaceMemberMinistries` upsert/soft-delete semantics; multiple active
  assignments surface in `activeMinistries`.
- Controller: `PUT /members/{id}/ministries` admin-only (403 for MEMBER); mapper round-trip.
- Migration verified against existing data shape.

## Web (`hanmaum-dn-web-app`)

### Grid (the original ask)
- `MemberSummary.activeMinistries?: string[]` (replaces the old single-name idea).
- Replace the stubbed Ministry column at
  [members-list.component.ts:130](../../../src/app/features/members/members-list/members-list.component.ts#L130)
  with a chips renderer: new **`MinistryChipsCellComponent`** mirroring
  `TrainingChipsCellComponent` — one chip per active ministry name, `—` when empty.
  `valueGetter: p => p.data?.activeMinistries ?? []`.

### Member edit form
- New **Ministry editor**, mirroring the Training card editor in
  `MemberEditComponent`: a `FormArray` of cards, each with
  - ministry `<select>` (options from `GET /ministries`, loaded like the training catalog),
  - **start** month + year selects (required),
  - **end** month + year selects + an **"ongoing"** checkbox that clears + disables end,
  - an optional **note** text input (max 500 chars).
- Reuse `MONTH_OPTIONS` / `YEAR_OPTIONS` and the
  `completedAtFromMonthYear` / `monthYearFromCompletedAt` helpers (rename/generalize if
  needed) for first-of-month ↔ month/year mapping.
- `MemberService.replaceMemberMinistries(publicId, items)`; wire into `save()` via the
  same `switchMap` chain as trainings, guarded so an unloaded ministry catalog cannot
  send an empty list and wipe existing assignments.

### Member detail view
- `MinistryHistory` model → `{ ministryPublicId, name, startDate, endDate, note }`.
- Render each ministry as `name` + `start – end`, or `name` + `start – present` when
  `endDate` is null; show `note` underneath when present.

### Tests (web)
- `MinistryChipsCellComponent`: empty → `—`; N names → N chips.
- Editor: add/remove card, "ongoing" toggle disables/clears end, save maps to items,
  catalog-guard prevents accidental wipe.
- Model mapping helpers (first-of-month ↔ month/year) for ministries.

## Out of scope / non-goals
- No granular add/remove ministry endpoints — replace-set only (consistent with trainings).
- No member-facing ministry self-service (the abandoned flow is removed, not replaced).
- No physical table rename — table stays `ministry_registrations`; entity renamed only.
- No change to the Ministry catalog CRUD (`POST/PATCH/DELETE /ministries`) — unchanged.

## Decision log
- **2026-06-05** — Approved over the persistence-scope doc's Option A/B/C analysis.
  Chose the start/end-date model ("Option C"-shaped) because the year-based
  registration flow is being abandoned, so the model had to change regardless;
  full-replace removal chosen to avoid leaving contradictory dead code.
- **2026-06-05** — Keep the `note` field and surface it in the UI (editor input +
  detail display). Keep the physical table name `ministry_registrations`; rename the
  JPA entity only.
