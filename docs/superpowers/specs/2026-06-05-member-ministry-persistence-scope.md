# Member Ministry History — Persistence Scope

**Date:** 2026-06-05
**Status:** SUPERSEDED 2026-06-05 by
[2026-06-05-member-ministry-assignments-design.md](./2026-06-05-member-ministry-assignments-design.md),
which adopts a start/end-date assignment model and removes the self-register flow.
Original status: Option A executed 2026-06-05 (dead editor removed; ministry read-only).
**Relates to:** [2026-05-29-member-form-training-ministry-tabs-design.md](./2026-05-29-member-form-training-ministry-tabs-design.md)

## TL;DR

The member edit form's **Ministry History** cards (type dropdown + From/To month-year +
"Present") **do not save to the database**, and — unlike Training — they never will by simply
"adding the backend later." The form's `MinistryRecord` shape was invented in the UI and does
**not** match the backend's real ministry model. Wiring persistence is a **contract-reconciliation
project**, not a localized seam.

Per `mvp-focus`, this is **deferred (post-MVP)** unless `hanmaum-dn-ops/MVP_SCOPE.md`
explicitly lists admin-edited member ministry registration. The existing code deliberately
stubbed it ("display-only for now"), which is consistent with deferral.

## What's broken / missing today

### 1. Display (FIXED 2026-06-05)
The detail view showed `undefined/NaN – now` for every ministry card. Root cause: the frontend
`MinistryRecord` declares `type / startMonth / startYear / endMonth / endYear / ongoing`, but the
backend `GET /members/{id}` → `ministries[]` actually returns
`{ ministryPublicId, name, registrationPeriod, status }`. `mmYy(undefined, undefined)` produced
`"undefined" / String(undefined % 100)="NaN"`.

**Fix applied:** added a `MinistryHistory` interface matching the real DTO, pointed
`Member.ministries` at it, and changed the detail view to render `m.name` + `m.registrationPeriod`
(the backend already pre-formats the period). The fictional `MinistryRecord` is retained only as
the (still-unwired) edit-form shape.

### 2. Persistence (NOT done — this scope)
- The edit form's `save()` request body has no `ministries` field; only trainings are persisted
  (`PUT /members/{id}/trainings`).
- `rebuildActivities()` calls `this.ministries.clear()` on load — existing registrations don't
  even populate the form, so there is nothing to "edit."
- `MemberService` (web) has no ministry write method.
- `MemberController` (server) has **no** `/{publicId}/ministries` endpoint.

## The core problem: two incompatible models

| | Frontend form (`MinistryRecord`) | Backend (`MinistryRegistration`) |
|---|---|---|
| Identity | `type` enum (MEDIA, NEWCOMER, …) hardcoded in UI | FK to a **Ministry** entity (`ministryPublicId`, admin-managed catalog) |
| Period | `startMonth/Year` → `endMonth/Year` + `ongoing` | single `registrationPeriod` string, **length 4** (a year, e.g. `"2024"`) |
| State | n/a | `RegistrationStatus` (PENDING/APPROVED/…) |
| Uniqueness | duplicates allowed | unique `(ministry_id, member_id, registration_period)` |
| Who creates it | imagined: admin types free-form history | today: member **self-registers**; admin **approves/rejects** |

A full write path for the backend model **already exists**, under the Ministry feature, not the
member form:
- `POST   /ministries/{publicId}/registrations` — self-register
- `GET    /ministries/{publicId}/registrations` — list
- `PATCH  /ministries/{publicId}/registrations/{regPublicId}` — approve/reject
- `DELETE /ministries/{publicId}/registrations/{regPublicId}` — withdraw

So "ministry history" is not missing a backend — it's a **different feature** (ministry
registrations) surfaced read-only on the member. The member-form UI models a CV-style free-form
history that the domain doesn't have.

## Options (decide before building)

**Option A — Drop the editor, keep read-only (recommended, smallest).**
Treat member ministry history as a read-only projection of `MinistryRegistration`. Remove the
non-functional Ministry editor from `MemberEditComponent` (the FormArray, `addMinistry`,
`onOngoingChange`, the template block, `MinistryRecord`, `MINISTRY_TYPE_*`). Admins manage
registrations via the existing Ministry feature. **No backend change.** Net effect: delete dead UI.

**Option B — Admin-manage registrations from the member form.**
Add an admin write path keyed to the *real* model:
- Backend: `PUT /v1/members/{publicId}/ministries` taking
  `[{ ministryPublicId, registrationPeriod, status }]`, replacing the member's registrations
  (mirror of `replaceMemberTrainings`). Reuse `MinistryRegistration` + its repository; respect the
  unique constraint and `RegistrationStatus`. Admin-only authorization.
- Web: rebuild the Ministry editor around a **Ministry picker** (from `GET /ministries`) + a
  **period (year)** select + a **status** select — *not* type-enum + month-range + Present.
  Add `replaceMemberMinistries()` to `MemberService`, wire into `save()`, drop the
  `ministries.clear()` so existing rows load.
- Migration: none (table exists). Possibly seed/validation only.

**Option C — Reshape the backend to the form's model (NOT recommended).**
Add start/end month-year + ongoing to `MinistryRegistration`. Contradicts the existing Ministry
feature and the year-based `registrationPeriod`; largest blast radius. Avoid.

## Recommendation

1. **Now:** keep the display fix (done).
2. **Pick A or B by MVP scope:**
   - If member ministry editing is **not** in `MVP_SCOPE.md` → **Option A** (delete dead editor) or
     leave as-is and file Option B as `post-mvp`.
   - If it **is** in scope → **Option B**, built against the real `MinistryRegistration` contract.
3. Do **not** build Option C.

## Decision log

- **2026-06-05 — Option A executed.** The non-functional ministry editor was removed from
  `MemberEditComponent` (`.html` + `.ts`): the `ministries` FormArray + getter, `addMinistry`,
  `removeMinistry`, `onOngoingChange`, `newMinistryGroup`, the `ministryTypeOptions` field, the
  Ministry box template, and the `ministries.clear()` load stub. The orphaned `MinistryRecord` /
  `MinistryType` / `MINISTRY_TYPE_LABELS` / `MINISTRY_TYPE_OPTIONS` exports were deleted from
  `member-activity.model.ts`. Ministry remains visible **read-only** on the member detail view via
  {@link MinistryHistory}. No backend change. If admin-edit is later required, implement **Option B**.

## Estimate (Option B, if greenlit)

- Backend: endpoint + service replace logic + mapper + tests (~0.5–1 day).
- Web: ministry picker UI rework + service + form load/save wiring + tests (~1 day).
- Contract doc update (`api-contracts`). No DB migration.
