# Church Groups Legend Filter — Design Spec

**Date:** 2026-06-11  
**Branch:** feat/churchgroupFE  
**Status:** Approved

---

## Summary

Add interactive category filtering to the Church Groups table. Legend items become toggle buttons; clicking activates a category, clicking again deactivates it. When one or more categories are active, cells whose category is not in the active set are dimmed to ~20% opacity. No rows collapse and no cells disappear — the table layout is fully preserved.

---

## Data Model

No changes to `MatrixCell`, `ChurchGroupMatrix`, or `buildMatrix`. The filter state is a pure view concern.

---

## Component Changes (`church-groups-list.component.ts`)

### New state

```ts
readonly activeCategories = signal<Set<MemberCategory>>(new Set());
```

- Empty set = no filter active = show all (default on load).

### Toggle method

```ts
toggleCategory(cat: MemberCategory): void {
  this.activeCategories.update(current => {
    const next = new Set(current);
    next.has(cat) ? next.delete(cat) : next.add(cat);
    return next;
  });
}
```

### Dim helper

```ts
isDimmed(cat: MemberCategory): boolean {
  const active = this.activeCategories();
  return active.size > 0 && !active.has(cat);
}
```

Called once per cell in the template — no computed matrix rebuild needed.

---

## Template Changes (`church-groups-list.component.html`)

### Legend items → toggle buttons

Each legend row becomes a `<button>` (or `<div role="button">`) with:

- `cursor-pointer` always
- Full opacity + a visible ring/border when the category is in `activeCategories`
- Reduced opacity (`opacity-40`) when NOT in `activeCategories` AND the set is non-empty
- Normal appearance when the set is empty (nothing filtered)

```html
@for (cat of filterCategories; track cat) {
  <button (click)="toggleCategory(cat)"
    class="flex items-center gap-2 rounded px-1 py-0.5 transition-opacity"
    [class.opacity-40]="isDimmed(cat)"
    [class.ring-1]="activeCategories().has(cat)"
    [class.ring-gray-500]="activeCategories().has(cat)">
    <span class="inline-block w-4 h-4 rounded-sm border border-gray-200"
          [style.background-color]="categoryConfig[cat].color"></span>
    <span class="text-xs text-gray-700">{{ categoryConfig[cat].label }}</span>
  </button>
}
```

### Table cells

Add `transition-opacity` and conditional opacity to every `<td>` that holds a member cell:

```html
[class.opacity-20]="isDimmed(cell.category)"
```

Applied to both the regular group cells and the newcomers column cells. Empty cells are unaffected.

---

## Visual Behaviour

| State | Legend items | Matching cells | Non-matching cells |
|---|---|---|---|
| Nothing selected (default) | Normal opacity, no ring | Normal | Normal |
| One+ categories selected | Active: ring + full opacity; Inactive: 40% opacity | Full opacity | 20% opacity |

---

## Out of Scope

- Persisting filter state to URL or local storage
- Collapsing/hiding rows or columns
- Any changes to `ChurchGroupsService` or the data model
