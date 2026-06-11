# 예비순장 Highlighter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the `예비순장` legend button so it doubles as a highlight/edit mode — when active, `제자반수료` cells gain a pulsing ring and become clickable to toggle `isNextGroupLeader` on each member, with optimistic local update and revert on failure.

**Architecture:** All changes live in the `ChurchGroupsListComponent`. `isDimmed` is updated to exempt `DISCIPLESHIP_COMPLETED` when `NEXT_LEADER` is active. A new `toggleCellHighlight` method mutates the private `members` signal optimistically and calls the existing `patchMemberFlags` service method. On failure the mutation reverts and a short-lived error signal triggers a toast.

**Tech Stack:** Angular 17+ signals, RxJS, Jasmine/Karma unit tests, Tailwind CSS (for toast), inline component styles (for CSS animation).

---

## File Map

| File | Change |
|---|---|
| `src/app/features/church-groups/church-groups-list/church-groups-list.component.ts` | Update `isDimmed`, add `highlightModeActive` computed, `isCellClickable`, `toggleCellHighlight`, `patchError` signal |
| `src/app/features/church-groups/church-groups-list/church-groups-list.component.html` | Add `.cg-candidate` / `.cg-interactive` class bindings, click handlers, error toast |
| `src/app/features/church-groups/church-groups-list/church-groups-list.component.spec.ts` | Add `isDimmed` + `toggleCellHighlight` test cases |

No new files. No service changes. No backend schema changes.

---

## Task 1: Update `isDimmed` + tests

**Files:**
- Modify: `src/app/features/church-groups/church-groups-list/church-groups-list.component.spec.ts`
- Modify: `src/app/features/church-groups/church-groups-list/church-groups-list.component.ts`

- [ ] **Step 1: Add failing tests for the new `isDimmed` behaviour**

  Open `church-groups-list.component.spec.ts`. Inside the existing `describe('isDimmed', ...)` block, add these two cases after the last existing `it(...)`:

  ```typescript
  it('does not dim DISCIPLESHIP_COMPLETED when only NEXT_LEADER is active', () => {
    component.toggleCategory('NEXT_LEADER');
    expect(component.isDimmed('DISCIPLESHIP_COMPLETED')).toBeFalse();
  });

  it('still dims other non-NEXT_LEADER categories when NEXT_LEADER is active', () => {
    component.toggleCategory('NEXT_LEADER');
    expect(component.isDimmed('ONE_ON_ONE_COMPLETED')).toBeTrue();
  });
  ```

- [ ] **Step 2: Run the new tests and confirm they fail**

  ```
  npx ng test --include="**/church-groups-list.component.spec.ts" --watch=false
  ```

  Expected: the two new `it` blocks fail (current `isDimmed` does not have the exemption).

- [ ] **Step 3: Update `isDimmed` in the component**

  In `church-groups-list.component.ts`, replace:

  ```typescript
  isDimmed(cat: MemberCategory): boolean {
    const active = this.activeCategories();
    return active.size > 0 && !active.has(cat);
  }
  ```

  with:

  ```typescript
  isDimmed(cat: MemberCategory): boolean {
    const active = this.activeCategories();
    if (active.size === 0) return false;
    if (active.has('NEXT_LEADER') && cat === 'DISCIPLESHIP_COMPLETED') return false;
    return !active.has(cat);
  }
  ```

- [ ] **Step 4: Run tests and confirm all pass**

  ```
  npx ng test --include="**/church-groups-list.component.spec.ts" --watch=false
  ```

  Expected: all tests in the file pass.

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/features/church-groups/church-groups-list/church-groups-list.component.ts
  git add src/app/features/church-groups/church-groups-list/church-groups-list.component.spec.ts
  git commit -m "feat(church-groups): exempt 제자반수료 from dimming when 예비순장 filter active"
  ```

---

## Task 2: Add `toggleCellHighlight` + helpers + tests

**Files:**
- Modify: `src/app/features/church-groups/church-groups-list/church-groups-list.component.spec.ts`
- Modify: `src/app/features/church-groups/church-groups-list/church-groups-list.component.ts`

- [ ] **Step 1: Add failing tests for `toggleCellHighlight`**

  At the top of `church-groups-list.component.spec.ts`, add these imports after the existing ones:

  ```typescript
  import { of, throwError } from 'rxjs';
  import { ChurchGroupsService } from '../church-groups.service';
  import { MemberSummary } from '../../../core/models/member.model';
  ```

  Then add a new `describe` block at the bottom of the outer `describe('ChurchGroupsListComponent', ...)`:

  ```typescript
  describe('toggleCellHighlight', () => {
    let service: ChurchGroupsService;

    const baseMember: MemberSummary = {
      publicId: 'pub-1',
      lastName: '김',
      firstName: '철수',
      email: null,
      memberStatus: 'ACTIVE',
      baptism: 'GENERAL_BAPTIZED',
      groupName: null,
      isNextGroupLeader: false,
    };

    beforeEach(() => {
      service = TestBed.inject(ChurchGroupsService);
      (component as any).members.set([{ ...baseMember }]);
    });

    it('flips isNextGroupLeader to true optimistically', () => {
      spyOn(service, 'patchMemberFlags').and.returnValue(of(undefined));
      component.toggleCellHighlight('pub-1');
      expect((component as any).members()[0].isNextGroupLeader).toBeTrue();
    });

    it('flips isNextGroupLeader to false when already true', () => {
      (component as any).members.set([{ ...baseMember, isNextGroupLeader: true }]);
      spyOn(service, 'patchMemberFlags').and.returnValue(of(undefined));
      component.toggleCellHighlight('pub-1');
      expect((component as any).members()[0].isNextGroupLeader).toBeFalse();
    });

    it('calls patchMemberFlags with the new value', () => {
      const spy = spyOn(service, 'patchMemberFlags').and.returnValue(of(undefined));
      component.toggleCellHighlight('pub-1');
      expect(spy).toHaveBeenCalledWith('pub-1', { isNextGroupLeader: true });
    });

    it('reverts isNextGroupLeader on patchMemberFlags failure', () => {
      spyOn(service, 'patchMemberFlags').and.returnValue(throwError(() => new Error('fail')));
      component.toggleCellHighlight('pub-1');
      expect((component as any).members()[0].isNextGroupLeader).toBeFalse();
    });

    it('sets patchError to true on failure', () => {
      spyOn(service, 'patchMemberFlags').and.returnValue(throwError(() => new Error('fail')));
      component.toggleCellHighlight('pub-1');
      expect(component.patchError()).toBeTrue();
    });

    it('does nothing when publicId is not found', () => {
      const spy = spyOn(service, 'patchMemberFlags');
      component.toggleCellHighlight('unknown-id');
      expect(spy).not.toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 2: Run and confirm tests fail**

  ```
  npx ng test --include="**/church-groups-list.component.spec.ts" --watch=false
  ```

  Expected: all six new tests fail with "toggleCellHighlight is not a function" or "patchError is not a function".

- [ ] **Step 3: Add `patchError`, `highlightModeActive`, `isCellClickable`, and `toggleCellHighlight` to the component**

  In `church-groups-list.component.ts`, add these members in the class body after `readonly activeCategories`:

  ```typescript
  readonly patchError = signal(false);

  readonly highlightModeActive = computed(() => this.activeCategories().has('NEXT_LEADER'));

  isCellClickable(cat: MemberCategory): boolean {
    return this.highlightModeActive() && (cat === 'DISCIPLESHIP_COMPLETED' || cat === 'NEXT_LEADER');
  }

  toggleCellHighlight(publicId: string): void {
    const current = this.members();
    const idx = current.findIndex(m => m.publicId === publicId);
    if (idx === -1) return;
    const newValue = !current[idx].isNextGroupLeader;
    this.members.set(current.map((m, i) => i === idx ? { ...m, isNextGroupLeader: newValue } : m));

    this.service.patchMemberFlags(publicId, { isNextGroupLeader: newValue }).subscribe({
      error: () => {
        this.members.update(ms =>
          ms.map(m => m.publicId === publicId ? { ...m, isNextGroupLeader: !newValue } : m),
        );
        this.patchError.set(true);
        setTimeout(() => this.patchError.set(false), 3000);
      },
    });
  }
  ```


- [ ] **Step 4: Run tests and confirm all pass**

  ```
  npx ng test --include="**/church-groups-list.component.spec.ts" --watch=false
  ```

  Expected: all tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/features/church-groups/church-groups-list/church-groups-list.component.ts
  git add src/app/features/church-groups/church-groups-list/church-groups-list.component.spec.ts
  git commit -m "feat(church-groups): add toggleCellHighlight with optimistic update and revert"
  ```

---

## Task 3: Add CSS animation for `.cg-candidate`

**Files:**
- Modify: `src/app/features/church-groups/church-groups-list/church-groups-list.component.ts` (inline styles)

- [ ] **Step 1: Add keyframe animation and helper classes to the component's inline `styles`**

  In `church-groups-list.component.ts`, find the `styles: [\`...\`]` array. Append these rules inside the backtick string, after the last existing rule (`.cg-table .cg-div-end { ... }`):

  ```css
  @keyframes candidate-pulse {
    0%, 100% { outline: 2px dashed #a855f7; outline-offset: -2px; }
    50%       { outline-color: transparent; }
  }
  .cg-candidate { animation: candidate-pulse 1.5s ease-in-out infinite; cursor: pointer; }
  .cg-interactive { cursor: pointer; }
  ```

  `.cg-candidate` — applied to `DISCIPLESHIP_COMPLETED` cells in highlight mode (pulsing purple dashed border).
  `.cg-interactive` — applied to `NEXT_LEADER` cells in highlight mode (pointer cursor only, no animation).

- [ ] **Step 2: Commit**

  ```bash
  git add src/app/features/church-groups/church-groups-list/church-groups-list.component.ts
  git commit -m "feat(church-groups): add candidate-pulse CSS animation for 예비순장 highlight mode"
  ```

---

## Task 4: Wire template bindings + error toast

**Files:**
- Modify: `src/app/features/church-groups/church-groups-list/church-groups-list.component.html`

- [ ] **Step 1: Update group member cells**

  In the template, find the `@if (group.members[i]; as cell)` block (currently lines 67–70). Replace the `<td>` inside it with:

  ```html
  <td class="cg-cell" [class.cg-div-end]="groupLast"
      [style.background-color]="categoryConfig[cell.category].color"
      [class.opacity-20]="isDimmed(cell.category)"
      [class.cg-candidate]="highlightModeActive() && cell.category === 'DISCIPLESHIP_COMPLETED'"
      [class.cg-interactive]="highlightModeActive() && cell.category === 'NEXT_LEADER'"
      (click)="isCellClickable(cell.category) && toggleCellHighlight(cell.publicId)">{{ cell.displayName }}</td>
  ```

- [ ] **Step 2: Update newcomers column cells**

  Find the `@if (matrix().newcomers[i]; as cell)` block (currently lines 76–79). Replace the `<td>` inside it with:

  ```html
  <td class="cg-cell cg-center"
      [style.background-color]="categoryConfig[cell.category].color"
      [class.opacity-20]="isDimmed(cell.category)"
      [class.cg-candidate]="highlightModeActive() && cell.category === 'DISCIPLESHIP_COMPLETED'"
      [class.cg-interactive]="highlightModeActive() && cell.category === 'NEXT_LEADER'"
      (click)="isCellClickable(cell.category) && toggleCellHighlight(cell.publicId)">{{ cell.displayName }}</td>
  ```

- [ ] **Step 3: Add error toast**

  Immediately before the closing `</div>` of the outer `<div class="flex flex-col gap-4 p-6">`, add:

  ```html
  @if (patchError()) {
    <div class="fixed bottom-4 right-4 bg-red-500 text-white text-sm px-4 py-2 rounded shadow-lg z-50">
      저장 실패. 다시 시도해주세요.
    </div>
  }
  ```

- [ ] **Step 4: Run the full test suite to make sure nothing broke**

  ```
  npx ng test --watch=false
  ```

  Expected: all tests pass.

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/features/church-groups/church-groups-list/church-groups-list.component.html
  git commit -m "feat(church-groups): wire 예비순장 highlight mode cell bindings and error toast"
  ```

---

## Task 5: Manual smoke test

- [ ] Start the dev server: `npx ng serve`
- [ ] Open the church groups page
- [ ] Click `예비순장` in the legend — verify:
  - `NEXT_LEADER` (pink) cells are fully visible
  - `DISCIPLESHIP_COMPLETED` (purple) cells are fully visible with a pulsing dashed ring
  - All other cells are dimmed
- [ ] Click a `DISCIPLESHIP_COMPLETED` cell — verify it instantly turns pink (NEXT_LEADER category)
- [ ] Click the same cell again (now pink) — verify it reverts to purple (DISCIPLESHIP_COMPLETED)
- [ ] Click a pre-existing pink `NEXT_LEADER` cell — verify it reverts to purple
- [ ] Click `예비순장` again to deactivate — verify the pulsing rings disappear and all cells return to normal opacity
- [ ] Reload the page and confirm the flag was persisted (cell stays pink if still marked)
