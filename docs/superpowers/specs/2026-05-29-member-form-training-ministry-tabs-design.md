# Member Form — Training & Ministry Tabs

**Date:** 2026-05-29
**Status:** Approved (design)
**Scope:** Frontend only (`hanmaum-dn-web-app`). No backend, API, or DB changes.

## Goal

Add three tabs to the top of the shared member form (`MemberEditComponent`, used by both
**Add Member** and **Edit Member**): **Basic Info**, **Training**, **Ministry**.

- **Basic Info** keeps the current form unchanged.
- **Training** captures up to 3 completed trainings (each training once).
- **Ministry** captures an unlimited, CV-style history of ministry stints with date ranges.

Training and ministry data is held in the form's in-memory model only. It is **not persisted**
yet — the member model has no such fields on the frontend or the Kotlin/Postgres backend, and
adding tables is explicitly out of scope. The design must make that backend work a localized,
low-risk addition later.

## Non-goals (YAGNI)

- No backend entity, DTO, Flyway migration, or service changes.
- No changes to the `Member` / `CreateMemberRequest` / `UpdateMemberRequest` model shapes.
- No display of training/ministry in the member **detail** view — this is the form only.
- No hard validation gating save; incomplete cards are simply ignored on collect.

## Tab chrome

Reuse the existing custom underline-tab pattern from
`features/ministry/ministry-list/ministry-list.component.html` (buttons with an active
bottom-border). No PrimeNG `TabView` (none is used in the app).

- `activeTab = signal<'basic' | 'training' | 'ministry'>('basic')`.
- Tab bar sits inside the form card, above the section content.
- Tab bodies are toggled with `@if`. All three live inside the **same** `<form>`, so the
  reactive model — including the `FormArray`s — persists across tab switches.
- The **Save / Cancel** action bar stays below the tabs, visible on every tab.

## Data model (contract-shaped, not yet persisted)

New co-located file `core/models/member-activity.model.ts`, following the existing
value+label convention used for `Gender` / `Baptism` in `member.model.ts`. These interfaces are
intentionally shaped like a future API contract so they can move onto `Member` /
the request DTOs with minimal change.

```ts
export type TrainingType = 'QTBS' | 'ONE_ON_ONE' | 'DISCIPLESHIP';

export interface TrainingRecord {
  type: TrainingType;
  completedMonth: number;   // 1–12
  completedYear: number;    // full year, e.g. 2022
}

export type MinistryType =
  | 'MEDIA' | 'NEWCOMER' | 'OPERATION' | 'WELCOME'
  | 'CARPOOL' | 'GOSPEL' | 'REFUGEE' | 'STREET_EVANGELISM';

export interface MinistryRecord {
  type: MinistryType;
  startMonth: number;       // 1–12
  startYear: number;        // full year
  endMonth: number | null;  // null when ongoing
  endYear: number | null;   // null when ongoing
  ongoing: boolean;
}
```

Label maps + option arrays (mirroring `GENDER_LABELS` / `GENDER_OPTIONS`):

- `TRAINING_TYPE_LABELS`: QTBS → `QTBS`, ONE_ON_ONE → `1on1`, DISCIPLESHIP → `Discipleship`
- `MINISTRY_TYPE_LABELS`: Media, Newcomer, Operation, Welcome, Carpool, Gospel, Refugee,
  Street Evangelism
- `MONTH_OPTIONS`: value `1`–`12`, label `"01"`–`"12"`
- `YEAR_OPTIONS`: value `2000`–`2035`, label `"00"`–`"35"` (two-digit display, full-year value)

## Reactive form additions

Added to the existing `form` `FormGroup`:

```ts
trainings:  FormArray<FormGroup<{ type; month; year }>>                       // max 3
ministries: FormArray<FormGroup<{ type; startMonth; startYear;
                                  endMonth; endYear; ongoing }>>              // unlimited
```

Helper methods on the component:

- `addTraining()` / `removeTraining(i)` — push/remove; "Add" disabled at length 3.
- `availableTrainingOptions(index)` — full training list minus types selected in **other**
  rows, so each of the 3 trainings can be picked at most once.
- `addMinistry()` / `removeMinistry(i)` — new ministry card is **unshifted to the top**
  (newest-first, CV style); no cap, duplicates allowed.
- `toggleOngoing(i)` — when `ongoing` is true, disable + clear the card's `endMonth`/`endYear`.

## Tab bodies

**Training** — for each card: `[ type ▾ ] [ MM ▾ ] / [ YY ▾ ] [🗑]`. "Add training" button below,
disabled at 3 cards. Type dropdown uses `availableTrainingOptions(i)`.

**Ministry** — newest on top. For each card:
`[ ministry ▾ ]  [MM ▾]/[YY ▾]  –  [MM ▾]/[YY ▾]  ☐ Present  [🗑]`. The **Present** toggle
(PrimeNG `p-checkbox`) disables the end selects and the range renders as `… – now`.
"Add ministry" button below, no limit.

## Persistence seam (the "easy to add backend later" part)

Concentrate all model↔form translation so future backend wiring is one localized change:

- `private collectActivities(): { trainings: TrainingRecord[]; ministries: MinistryRecord[] }`
  — maps the `FormArray`s to the typed records (drops incomplete cards). Pure, unit-testable.
- `private rebuildActivities(trainings?, ministries?)` — clears and repopulates the
  `FormArray`s from typed records (used by the load path).
- In `save()`, a single clearly-marked block builds `collectActivities()` and shows where the
  records attach to the request once the API exists. Today it is **not** attached to
  `CreateMemberRequest` / `UpdateMemberRequest`, and a `// TODO(backend): not persisted yet`
  comment marks the exact line.
- In `patchForm()`, a single call to `rebuildActivities(...)` marks the load seam (no-op today
  because `Member` carries no such fields).

When the backend lands, the change is: add fields to the model interfaces, attach
`collectActivities()` output in `save()`, and pass `member.*` into `rebuildActivities()` in
`patchForm()`. No template or control-structure changes.

## New PrimeNG import

`CheckboxModule` for the **Present** toggle. Selects reuse the existing `SelectModule`.

## Testing

- Unit-test `collectActivities()` / `rebuildActivities()` round-trip and incomplete-card dropping.
- Unit-test `availableTrainingOptions()` excludes types chosen in other rows.
- Manual: tab switching preserves entered data; training capped at 3 with unique types;
  ministry unlimited with working Present toggle; save still succeeds (activities silently dropped).
