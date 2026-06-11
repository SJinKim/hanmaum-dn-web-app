# Church Groups Legend Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Church Groups legend items interactive toggles that dim non-matching table cells.

**Architecture:** Pure component-level signal state — no service changes. `activeCategories` (a `Set<MemberCategory>` signal) drives both legend toggle styling and cell opacity. Empty set = show all; non-empty set = dim cells whose category is not in the set.

**Tech Stack:** Angular 17+ (signals, `@for`), Tailwind CSS

---

## File Map

| File | Change |
|---|---|
| `src/app/features/church-groups/church-groups-list/church-groups-list.component.ts` | Add `activeCategories` signal, `toggleCategory()`, `isDimmed()` |
| `src/app/features/church-groups/church-groups-list/church-groups-list.component.html` | Legend items → toggle buttons; add opacity class to member cells |
| `src/app/features/church-groups/church-groups-list/church-groups-list.component.spec.ts` | New — unit tests for `toggleCategory` and `isDimmed` |

---

### Task 1: Add filter state and logic to the component

**Files:**
- Modify: `src/app/features/church-groups/church-groups-list/church-groups-list.component.ts`
- Create: `src/app/features/church-groups/church-groups-list/church-groups-list.component.spec.ts`

- [ ] **Step 1: Create the spec file with failing tests**

Create `src/app/features/church-groups/church-groups-list/church-groups-list.component.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ChurchGroupsListComponent } from './church-groups-list.component';

describe('ChurchGroupsListComponent', () => {
  let component: ChurchGroupsListComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ChurchGroupsListComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    component = TestBed.createComponent(ChurchGroupsListComponent).componentInstance;
  });

  describe('toggleCategory', () => {
    it('adds a category when not present', () => {
      component.toggleCategory('NEXT_LEADER');
      expect(component.activeCategories().has('NEXT_LEADER')).toBeTrue();
    });

    it('removes a category when already active', () => {
      component.toggleCategory('NEXT_LEADER');
      component.toggleCategory('NEXT_LEADER');
      expect(component.activeCategories().has('NEXT_LEADER')).toBeFalse();
    });

    it('can have multiple categories active simultaneously', () => {
      component.toggleCategory('NEXT_LEADER');
      component.toggleCategory('UNBAPTIZED');
      expect(component.activeCategories().size).toBe(2);
    });
  });

  describe('isDimmed', () => {
    it('returns false for any category when nothing is active (show all)', () => {
      expect(component.isDimmed('NEXT_LEADER')).toBeFalse();
    });

    it('returns false for an active category', () => {
      component.toggleCategory('NEXT_LEADER');
      expect(component.isDimmed('NEXT_LEADER')).toBeFalse();
    });

    it('returns true for a category not in the active set', () => {
      component.toggleCategory('NEXT_LEADER');
      expect(component.isDimmed('UNBAPTIZED')).toBeTrue();
    });

    it('returns false for all categories once the set is empty again', () => {
      component.toggleCategory('NEXT_LEADER');
      component.toggleCategory('NEXT_LEADER');
      expect(component.isDimmed('UNBAPTIZED')).toBeFalse();
    });
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```
ng test --include=**/church-groups-list.component.spec.ts --watch=false
```

Expected: errors like `component.toggleCategory is not a function` and `component.activeCategories is not a function`.

- [ ] **Step 3: Add `activeCategories`, `toggleCategory`, and `isDimmed` to the component**

In `church-groups-list.component.ts`, add after the existing `readonly categoryConfig = CATEGORY_CONFIG;` line:

```typescript
readonly activeCategories = signal<Set<MemberCategory>>(new Set());

toggleCategory(cat: MemberCategory): void {
  this.activeCategories.update(current => {
    const next = new Set(current);
    next.has(cat) ? next.delete(cat) : next.add(cat);
    return next;
  });
}

isDimmed(cat: MemberCategory): boolean {
  const active = this.activeCategories();
  return active.size > 0 && !active.has(cat);
}
```

Also add `MemberCategory` to the import from `'../church-groups.service'` if not already imported (it is already exported from that file).

- [ ] **Step 4: Run tests to confirm they pass**

```
ng test --include=**/church-groups-list.component.spec.ts --watch=false
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/church-groups/church-groups-list/church-groups-list.component.ts
git add src/app/features/church-groups/church-groups-list/church-groups-list.component.spec.ts
git commit -m "feat(church-groups): add activeCategories signal and toggle/isDimmed logic"
```

---

### Task 2: Wire filter state into the template

**Files:**
- Modify: `src/app/features/church-groups/church-groups-list/church-groups-list.component.html`

- [ ] **Step 1: Replace the legend `<div>` rows with toggle buttons**

Replace the entire `@for` block inside the legend box (lines 8–16 in the current template):

```html
@for (cat of filterCategories; track cat) {
  <button
    type="button"
    (click)="toggleCategory(cat)"
    class="flex items-center gap-2 rounded px-1 py-0.5 transition-opacity cursor-pointer"
    [class.opacity-40]="isDimmed(cat)"
    [class.ring-1]="activeCategories().has(cat)"
    [class.ring-gray-500]="activeCategories().has(cat)">
    <span
      class="inline-block w-4 h-4 rounded-sm border border-gray-200"
      [style.background-color]="categoryConfig[cat].color"></span>
    <span class="text-xs text-gray-700">{{ categoryConfig[cat].label }}</span>
  </button>
}
```

- [ ] **Step 2: Add opacity dimming to the regular group member cells**

Find the `<td>` for a filled group cell (the one with `[style.background-color]`):

```html
<td class="cg-cell" [class.cg-div-end]="groupLast" [style.background-color]="categoryConfig[cell.category].color">{{ cell.displayName }}</td>
```

Add `[class.opacity-20]="isDimmed(cell.category)"`:

```html
<td class="cg-cell" [class.cg-div-end]="groupLast"
    [style.background-color]="categoryConfig[cell.category].color"
    [class.opacity-20]="isDimmed(cell.category)">{{ cell.displayName }}</td>
```

- [ ] **Step 3: Add opacity dimming to the newcomers column cell**

Find the newcomers `<td>`:

```html
<td class="cg-cell cg-center" [style.background-color]="categoryConfig[cell.category].color">{{ cell.displayName }}</td>
```

Add `[class.opacity-20]="isDimmed(cell.category)"`:

```html
<td class="cg-cell cg-center"
    [style.background-color]="categoryConfig[cell.category].color"
    [class.opacity-20]="isDimmed(cell.category)">{{ cell.displayName }}</td>
```

- [ ] **Step 4: Run the full test suite to check for regressions**

```
ng test --watch=false
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/church-groups/church-groups-list/church-groups-list.component.html
git commit -m "feat(church-groups): wire legend filter toggles and cell dimming"
```
