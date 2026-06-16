# Church Groups Table Rebuild — Design Spec

**Date:** 2026-06-10
**Status:** Approved
**Supersedes:** Rendering sections (6–8) of `2026-06-10-church-groups-matrix-design.md`. Backend, routing, category computation, and model changes from that spec remain in force.

---

## 1. Problem

The Church Groups page renders with AG Grid, but the result does not match the target spreadsheet layout (3-level merged headers, tight colored cells, a 새가족순 column, and a corner legend). AG Grid is the wrong tool for this view:

- The data is **column-oriented** (each 순 is a vertical list of members), but AG Grid is row-oriented. The current `buildMatrix` fakes rows by padding every group to the longest group's length so AG Grid has row-shaped data to render.
- The dataset is **small** (~14 groups × tens of members) — no virtualization, sorting, or filtering engine is needed.
- The view needs **merged multi-level headers** and **per-cell background colors**, which `<table>` does natively via `colspan`/`rowspan` and inline styles, but AG Grid makes awkward.

## 2. Decision

Replace the AG Grid rendering with a **native HTML `<table>`**, reusing the existing data/service layer. Build a **static, read-only** colored table first; cell-edit popover and category-filter dimming are deferred to a later pass.

### Approaches considered

| Approach | Verdict |
|---|---|
| **A. Native HTML `<table>` + `colspan`/`rowspan`** | ✅ Chosen — natural fit for merged headers + colored cells, minimal code |
| B. CSS Grid (`display: grid`) | Rejected — no native cell merging; header spans require manual `grid-column` math |
| C. Keep AG Grid, restyle | Rejected — keeps fighting the column-oriented model; theming won't reach the dense spreadsheet look |

---

## 3. Scope

### In scope
- Rebuild `church-groups-list.component.html` as an HTML table.
- Refactor `ChurchGroupsService.buildMatrix` to return a table-shaped model (Section 4).
- Move the 순장 (leader) lookup from the component into the service (it now owns the column model).
- Add a standalone **legend box above the table** (separate styled block, not embedded in the table corner).
- Remove AG Grid wiring from this component (`AgGridAngular`, `ModuleRegistry`, `themeQuartz`, `GridOptions`, `ColDef`/`ColGroupDef` builders).

### Deferred (per "static first")
- Cell click → edit popover (예비순장 / 일대일 신청서 PATCH).
- Category filter dimming.
- Markup is structured so these return as a click handler + class binding, not a rewrite.

### Out of scope (unchanged from prior spec)
- Backend changes, routing, sidebar entry — already implemented.
- Editing group assignment, reordering members, Excel/PDF export, mobile responsiveness.

---

## 4. Data Model Refactor

`buildMatrix` currently returns `MatrixRow[]` (`Record<string, MatrixCell | null>`). Replace with a structure that mirrors the table:

```typescript
export interface GroupColumn {
  publicId: string;
  division: string | null;   // top header (느헤미야 (시니어) …)
  name: string;              // 순 name (믿음, 소망 …)
  leader: string;            // 순장 display name, '' if none
  members: MatrixCell[];     // top-to-bottom, in order
}

export interface DivisionGroup {
  division: string;          // '' for the null/catch-all division
  groups: GroupColumn[];
}

export interface ChurchGroupMatrix {
  divisions: DivisionGroup[];  // grouped for colspan headers, in stable order
  newcomers: MatrixCell[];     // 새가족순 column
  rowCount: number;            // max over all group columns and newcomers
}
```

- `MatrixCell` is unchanged (`publicId`, `displayName`, `category`, `isNextGroupLeader`, `oneOnOneSignupFilled`).
- Leader lookup (`churchRole === '순장'`, `lastName + firstName`) moves into the service while building each `GroupColumn`.
- `rowCount` drives the `<tbody>` row loop; columns shorter than `rowCount` render empty cells for trailing rows.
- `CATEGORY_CONFIG`, `FILTER_CATEGORIES`, `computeCategory`, `NEWCOMERS_KEY`-style constants stay (NEWCOMERS_KEY no longer needed as a field key — drop if unused after refactor).
- Update `church-groups.service.spec.ts` to assert the new shape (grouping by division, leader resolution, `rowCount`, newcomers bucket).

---

## 5. Table Structure

```
<div> legend box (separate, above table)
<table>
  <thead>
    <tr> [순 index corner] | division (colspan = #groups) … | 새가족순 (rowspan=3)
    <tr> [순 label]        | 순 name | 순 name | …            |
    <tr> [순장 label]      | 순장    | 순장    | …            |
  <thead>
  <tbody>
    <tr> row 0: index | cell | cell | … | newcomer cell
    <tr> row 1: …
    … rowCount rows
```

- **Left index column:** two stacked header labels (순 / 순장) over a body column of row numbers (1…rowCount), matching the current index column. Confirm against the image during build; if the image shows no numbers, render blank body cells.
- **Division header:** one `<th colspan="{groups.length}">` per division.
- **새가족순 column:** single column on the far right; header `<th rowspan="3">새가족순</th>` (or stacked to match image), body cells from `newcomers`.
- **Body cells:** `<td>` with `style.background-color` = `CATEGORY_CONFIG[cell.category].color`; empty slots render a blank/placeholder `<td>`. Cell text = `cell.displayName`.
- Fixed column width (~100px) via CSS; `table-layout: fixed` for stable columns and truncation.

---

## 6. Component Changes (`church-groups-list.component.ts`)

- Drop AG Grid imports and `ModuleRegistry.registerModules`, `theme`, `gridOptions`, `onGridReady`, `gridApi`, `buildColumnDefs`, `buildContext`.
- Keep: `loading` signal, `members`/`groups` signals, `ngOnInit` data load.
- Replace `rowData`/`columnDefs` computeds with a single `matrix = computed(() => this.service.buildMatrix(...))` returning `ChurchGroupMatrix`.
- Keep `filterCategories` / `categoryConfig` exposed for the legend rendering (filter toggling deferred — render legend swatches, not active toggles, for now; or keep buttons inert).

---

## 7. Legend

A standalone block above the table (its own `<div>`, optionally a small `LegendComponent`):

- One row per filter category in priority order: colored swatch + label (예비순장, 제자반수료, 일대일진행, 일대일대기, 큐비세수료, 세례X 또는 확인대상).
- Colors from `CATEGORY_CONFIG`. Read-only for now (no toggle behavior in this pass).

---

## 8. Testing

- `church-groups.service.spec.ts`: update to the new `ChurchGroupMatrix` shape — division grouping, leader resolution, `rowCount`, newcomers, category assignment.
- Component becomes presentational; a render smoke test (loads, shows headers + cells) is sufficient.

---

## 9. Risks / Notes

- **Header alignment:** division `colspan` must equal the number of groups in that division, and the index + 새가족순 columns must be accounted for, or columns shift. Covered by `DivisionGroup.groups.length`.
- **Re-adding interactions later:** body `<td>` will carry the `MatrixCell`, so a future click handler + `[class.dimmed]` binding restores the popover and filter behavior without restructuring.
- Confirm the left index column's body content (row numbers vs. blank) against the image during implementation.
