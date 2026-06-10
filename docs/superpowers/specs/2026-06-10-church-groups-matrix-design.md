# Church Groups Matrix Dashboard — Design Spec

**Date:** 2026-06-10  
**Status:** Approved  
**Approach:** Extend existing members endpoint + frontend matrix (Approach B)

---

## 1. Overview

A new **Church Groups** page accessible via the side menu. It displays an AG-Grid matrix where:
- **Column groups** = church group divisions (e.g. 느헤미야/시니어, 다니엘/주니어)
- **Columns** = individual small group names within each division
- **Rows** = position slots (0…N, where N = size of the largest group)
- **Cells** = member name rendered on a colored background based on their discipleship category, or empty if the slot is unfilled

Six toggle filter buttons above the grid let admins show/dim members by category. Clicking a member cell opens an overlay panel for toggling admin-set flags.

---

## 2. Backend Changes

### 2.1 Database Migration (Flyway)

New migration file (next version after current highest):

```sql
ALTER TABLE members
  ADD COLUMN is_next_group_leader   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN one_on_one_signup_filled BOOLEAN NOT NULL DEFAULT FALSE;
```

### 2.2 Member Entity (`Member.kt`)

Add two fields:

```kotlin
@Column(name = "is_next_group_leader", nullable = false)
var isNextGroupLeader: Boolean = false

@Column(name = "one_on_one_signup_filled", nullable = false)
var oneOnOneSignupFilled: Boolean = false
```

### 2.3 DTOs

**`MemberSummaryDto`** — add both fields so the grid gets them:
```kotlin
val isNextGroupLeader: Boolean = false,
val oneOnOneSignupFilled: Boolean = false,
```

**`MemberDto`** — add both fields for the detail/edit view:
```kotlin
val isNextGroupLeader: Boolean = false,
val oneOnOneSignupFilled: Boolean = false,
```

**`UpdateMemberRequest`** — add as optional (PATCH semantics, null = no change):
```kotlin
val isNextGroupLeader: Boolean? = null,
val oneOnOneSignupFilled: Boolean? = null,
```

### 2.4 Mapper & Service

- `MemberMappers.kt`: map both fields from entity → DTOs.
- `MemberService.kt`: in the PATCH handler, apply the two new optional booleans when non-null (same pattern as existing optional fields).

### 2.5 No new endpoints

The existing `PATCH /api/v1/members/{publicId}` and `GET /api/v1/members` endpoints are sufficient after the DTO changes.

---

## 3. Frontend Architecture

### 3.1 New files

```
src/app/features/church-groups/
├── church-groups.routes.ts
├── church-groups.service.ts
└── church-groups-list/
    ├── church-groups-list.component.ts
    ├── church-groups-list.component.html
    └── cells/
        └── group-member-cell.component.ts
```

### 3.2 Routing & Menu

**`app.routes.ts`**: add lazy route:
```typescript
{
  path: 'church-groups',
  canActivate: [adminGuard],
  loadChildren: () => import('./features/church-groups/church-groups.routes')
    .then(m => m.CHURCH_GROUPS_ROUTES),
}
```

**`church-groups.routes.ts`**:
```typescript
export const CHURCH_GROUPS_ROUTES: Routes = [
  { path: '', component: ChurchGroupsListComponent },
];
```

**`sidebar.component.ts`**: add to `navItems`:
```typescript
{ label: 'Church Groups', icon: 'pi pi-th-large', route: '/church-groups' }
```

---

## 4. Data Flow

On component init, two parallel HTTP calls:

1. `GET /api/v1/members?status=ACTIVE&size=9999` → all active members with training and flag data
2. `GET /api/v1/church-groups` → list of `{ publicId, division, name }`

Both are fetched via `forkJoin`. Once both resolve, the component:

1. Computes each member's **category** using the priority chain (Section 5).
2. Groups members by `groupPublicId` → `Map<string, MemberWithCategory[]>`.
3. Generates **column definitions** from church groups data (Section 6).
4. Builds **row data** as a pivot array (Section 6).

---

## 5. Category Computation

A pure function `computeCategory(member: MemberSummary): MemberCategory` applies the following priority chain — first match wins:

| Priority | Category key | Label | Color | Condition |
|---|---|---|---|---|
| 1 | `NEXT_LEADER` | 예비순장 | `#f9a8d4` (pink) | `isNextGroupLeader === true` |
| 2 | `ONE_ON_ONE_IN_PROGRESS` | 일대일진행 | `#bbf7d0` (light green) | training named `일대일` with status `IN_PROGRESS` |
| 3 | `ONE_ON_ONE_WAITING` | 일대일대기 | `#fef08a` (yellow) | training named `QBS` with status `COMPLETED` **and** `oneOnOneSignupFilled === true` |
| 4 | `QBS_COMPLETED` | 큐비세수료 | `#bae6fd` (light blue) | training named `QBS` with status `COMPLETED` |
| 5 | `DISCIPLESHIP_COMPLETED` | 제자반수료 | `#ffffff` (white) | training named `제자반` with status `COMPLETED` |
| 6 | `UNBAPTIZED` | 세레X / 확인대상 | `#fed7aa` (orange) | `baptism` is `null` or `UNBAPTIZED` |
| — | `DEFAULT` | — | `#f9fafb` (off-white) | everything else |

Training name matching is **case-insensitive contains** (e.g. `name.toLowerCase().includes('qbs')`).

---

## 6. AG-Grid Matrix Structure

### 6.1 Column Definitions

Generated dynamically from church groups:

```typescript
// One ColGroupDef per unique division value
{
  headerName: '느헤미야 (시니어)',
  children: [
    { headerName: '믿음', field: 'group_<publicId>', cellRenderer: GroupMemberCellComponent, ... },
    { headerName: '소망', field: 'group_<publicId>', cellRenderer: GroupMemberCellComponent, ... },
    ...
  ]
}
```

Groups with `division === null` are placed in a catch-all column group with an empty header.

Column width: fixed `100px` per group column. No resizing.

### 6.2 Row Data

```typescript
interface MatrixRow {
  [groupFieldKey: string]: MatrixCell | null;
  // e.g. "group_abc123": { publicId, displayName, category } | null
}
```

Number of rows = `max(groupMemberCounts)`. Shorter groups have `null` in their column for the trailing rows.

### 6.3 Grid Options

```typescript
{
  rowHeight: 36,
  headerHeight: 40,
  suppressMovableColumns: true,
  suppressCellFocus: true,
  domLayout: 'autoHeight',
}
```

No sorting, no filtering, no pagination — this is a fixed display grid.

---

## 7. Custom Cell Renderer (`GroupMemberCellComponent`)

Implements `ICellRendererAngularComp`.

- **Non-null cell**: renders the member's display name (`lastName + firstName`) on a background color from the category map. Text is `12px`, truncated with `overflow: hidden`.
- **Null cell**: renders an empty div with a light border (slot placeholder).
- **Click handler**: opens a PrimeNG `OverlayPanel` anchored to the cell with two checkboxes:
  - ☑ 예비순장 — bound to `isNextGroupLeader`
  - ☑ 일대일 신청서 제출 — bound to `oneOnOneSignupFilled`
  - On checkbox change: fires `PATCH /api/v1/members/{publicId}` with the updated flag. Updates the local member data signal optimistically. Overlay closes on outside click.

---

## 8. Filter Toggle Buttons

Six pill-shaped toggle buttons above the grid, one per category (in priority order). Multi-select — any combination can be active simultaneously.

**Behavior:**
- **No buttons active** → all cells render normally.
- **One or more active** → cells whose member's category does NOT match any active filter render at `opacity: 0.2`. Empty cells (null) are unaffected.

The filter acts on cell-level opacity, not row visibility — this preserves the spatial layout of the group columns.

Button styling: colored background matching the category color, PrimeNG `p-togglebutton` or a styled `<button>` with active/inactive state.

---

## 9. Model Updates (Frontend)

**`member.model.ts`** — add to `MemberSummary` and `Member` interfaces:
```typescript
isNextGroupLeader?: boolean;
oneOnOneSignupFilled?: boolean;
```

**`UpdateMemberRequest`**:
```typescript
isNextGroupLeader?: boolean;
oneOnOneSignupFilled?: boolean;
```

---

## 10. Service (`church-groups.service.ts`)

```typescript
// Fetches both data sources in parallel
loadDashboardData(): Observable<{ members: MemberSummary[]; groups: ChurchGroupSummary[] }>

// Patches the two admin flags
patchMemberFlags(publicId: string, patch: { isNextGroupLeader?: boolean; oneOnOneSignupFilled?: boolean }): Observable<void>
```

Reuses `MemberService.getMembers()` for the member list call, or calls `ApiService` directly.

---

## 11. Out of Scope

- Editing member group assignment from this page (use Members → Edit for that)
- Reordering members within a group column
- Exporting the matrix to Excel/PDF
- Mobile responsiveness (admin-only page, desktop assumed)
