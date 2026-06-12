# Church Groups Table Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the AG Grid Church Groups view with a static, read-only native HTML `<table>` that matches the target spreadsheet layout (3-level merged headers, colored cells, 새가족순 column, legend box above the table).

**Architecture:** Reuse the existing `ChurchGroupsService` data/category layer. Refactor `buildMatrix` to return a table-shaped `ChurchGroupMatrix` (divisions → group columns → members, plus newcomers and `rowCount`). The component becomes presentational; the template renders the table and a standalone legend. Cell-edit popover and filter dimming are deferred.

**Tech Stack:** Angular 21 (standalone components, signals), TypeScript, Tailwind utility classes, Karma + Jasmine tests. AG Grid is removed from this component.

---

## File Structure

- **Modify** `src/app/features/church-groups/church-groups.service.ts` — replace `MatrixRow`/`buildMatrix` with `ChurchGroupMatrix` types + new `buildMatrix`; move 순장 (leader) lookup in. Drop `NEWCOMERS_KEY` if unused after.
- **Modify** `src/app/features/church-groups/church-groups.service.spec.ts` — rewrite the `buildMatrix` describe block for the new shape.
- **Modify** `src/app/features/church-groups/church-groups-list/church-groups-list.component.ts` — remove AG Grid wiring; expose `matrix` + `rowIndices` signals.
- **Modify** `src/app/features/church-groups/church-groups-list/church-groups-list.component.html` — rebuild as legend box + `<table>`.
- **Leave untouched** `cells/group-member-cell.component.ts` — dormant, revived in the later interactivity pass. Just remove its import from the list component.

---

### Task 1: Refactor service data model + `buildMatrix`

**Files:**
- Modify: `src/app/features/church-groups/church-groups.service.ts`
- Test: `src/app/features/church-groups/church-groups.service.spec.ts`

- [ ] **Step 1: Rewrite the `buildMatrix` describe block to the new shape**

Replace the entire `describe('buildMatrix', …)` block (lines 87–128) in `church-groups.service.spec.ts` with:

```typescript
  describe('buildMatrix', () => {
    const group1: ChurchGroupSummary = { publicId: 'g1', division: '느헤미야', name: '믿음' };
    const group2: ChurchGroupSummary = { publicId: 'g2', division: '느헤미야', name: '소망' };
    const group3: ChurchGroupSummary = { publicId: 'g3', division: '다니엘', name: '온유' };

    it('returns rowCount 0 and empty newcomers when no members', () => {
      const m = service.buildMatrix([], [group1]);
      expect(m.rowCount).toBe(0);
      expect(m.newcomers).toEqual([]);
      expect(m.divisions.length).toBe(1);
      expect(m.divisions[0].groups[0].members).toEqual([]);
    });

    it('groups columns by division in stable order', () => {
      const m = service.buildMatrix([], [group1, group2, group3]);
      expect(m.divisions.map(d => d.division)).toEqual(['느헤미야', '다니엘']);
      expect(m.divisions[0].groups.map(g => g.name)).toEqual(['믿음', '소망']);
      expect(m.divisions[1].groups.map(g => g.name)).toEqual(['온유']);
    });

    it('places members in the correct group column', () => {
      const member = makeMember({ groupPublicId: 'g1' });
      const m = service.buildMatrix([member], [group1, group2]);
      expect(m.divisions[0].groups[0].members.length).toBe(1);
      expect(m.divisions[0].groups[1].members.length).toBe(0);
    });

    it('rowCount equals the largest column size', () => {
      const members = [
        makeMember({ publicId: 'a', groupPublicId: 'g1' }),
        makeMember({ publicId: 'b', groupPublicId: 'g1' }),
        makeMember({ publicId: 'c', groupPublicId: 'g2' }),
      ];
      const m = service.buildMatrix(members, [group1, group2]);
      expect(m.rowCount).toBe(2);
    });

    it('rowCount accounts for the newcomers column', () => {
      const members = [
        makeMember({ publicId: 'a', groupPublicId: null }),
        makeMember({ publicId: 'b', groupPublicId: null }),
      ];
      const m = service.buildMatrix(members, [group1]);
      expect(m.rowCount).toBe(2);
      expect(m.newcomers.length).toBe(2);
    });

    it('places members with no groupPublicId in newcomers', () => {
      const member = makeMember({ groupPublicId: null });
      const m = service.buildMatrix([member], [group1]);
      expect(m.newcomers.length).toBe(1);
      expect(m.divisions[0].groups[0].members.length).toBe(0);
    });

    it('resolves the 순장 leader name for a group', () => {
      const leader = makeMember({ publicId: 'L', groupPublicId: 'g1', lastName: '서', firstName: '준', churchRole: '순장' });
      const m = service.buildMatrix([leader], [group1]);
      expect(m.divisions[0].groups[0].leader).toBe('서준');
    });

    it('leader is empty string when no 순장 in the group', () => {
      const member = makeMember({ publicId: 'x', groupPublicId: 'g1', churchRole: null });
      const m = service.buildMatrix([member], [group1]);
      expect(m.divisions[0].groups[0].leader).toBe('');
    });

    it('cell displayName is lastName+firstName', () => {
      const member = makeMember({ publicId: 'x', groupPublicId: 'g1', lastName: '이', firstName: '영희' });
      const m = service.buildMatrix([member], [group1]);
      expect(m.divisions[0].groups[0].members[0].displayName).toBe('이영희');
    });
  });
```

Also update the import on line 4 — remove `NEWCOMERS_KEY` (no longer exported):

```typescript
import { ChurchGroupsService } from './church-groups.service';
```

- [ ] **Step 2: Run the spec to verify it fails to compile/pass**

Run: `npm test -- --watch=false --browsers=ChromeHeadless`
Expected: FAIL — TypeScript errors (`buildMatrix` returns `MatrixRow[]`, no `.rowCount`/`.divisions`; `NEWCOMERS_KEY` import missing).

- [ ] **Step 3: Replace the types and `buildMatrix` in the service**

In `church-groups.service.ts`, replace the `MatrixRow`/`NEWCOMERS_KEY` declarations (lines 48–50) with the new model:

```typescript
export interface GroupColumn {
  publicId: string;
  division: string | null;
  name: string;
  leader: string;
  members: MatrixCell[];
}

export interface DivisionGroup {
  division: string;
  groups: GroupColumn[];
}

export interface ChurchGroupMatrix {
  divisions: DivisionGroup[];
  newcomers: MatrixCell[];
  rowCount: number;
}
```

Then replace the entire `buildMatrix` method (lines 82–116) with:

```typescript
  buildMatrix(members: MemberSummary[], groups: ChurchGroupSummary[]): ChurchGroupMatrix {
    const toCell = (m: MemberSummary): MatrixCell => ({
      publicId: m.publicId,
      displayName: m.lastName + m.firstName,
      category: this.computeCategory(m),
      isNextGroupLeader: m.isNextGroupLeader ?? false,
      oneOnOneSignupFilled: m.oneOnOneSignupFilled ?? false,
    });

    const leaderOf = (groupPublicId: string): string => {
      const leader = members.find(
        m => m.groupPublicId === groupPublicId && m.churchRole === '순장',
      );
      return leader ? leader.lastName + leader.firstName : '';
    };

    const columns = new Map<string, GroupColumn>();
    for (const g of groups) {
      columns.set(g.publicId, {
        publicId: g.publicId,
        division: g.division,
        name: g.name,
        leader: leaderOf(g.publicId),
        members: [],
      });
    }

    const newcomers: MatrixCell[] = [];
    for (const m of members) {
      const cell = toCell(m);
      if (m.groupPublicId && columns.has(m.groupPublicId)) {
        columns.get(m.groupPublicId)!.members.push(cell);
      } else {
        newcomers.push(cell);
      }
    }

    const divisions: DivisionGroup[] = [];
    const divIndex = new Map<string, DivisionGroup>();
    for (const col of columns.values()) {
      const key = col.division ?? '';
      let group = divIndex.get(key);
      if (!group) {
        group = { division: key, groups: [] };
        divIndex.set(key, group);
        divisions.push(group);
      }
      group.groups.push(col);
    }

    const columnLengths = Array.from(columns.values()).map(c => c.members.length);
    const rowCount = Math.max(0, ...columnLengths, newcomers.length);

    return { divisions, newcomers, rowCount };
  }
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npm test -- --watch=false --browsers=ChromeHeadless`
Expected: PASS — all `computeCategory` and `buildMatrix` specs green.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/church-groups/church-groups.service.ts src/app/features/church-groups/church-groups.service.spec.ts
git commit -m "refactor(church-groups): table-shaped ChurchGroupMatrix from buildMatrix"
```

---

### Task 2: Strip AG Grid from the list component

**Files:**
- Modify: `src/app/features/church-groups/church-groups-list/church-groups-list.component.ts`

- [ ] **Step 1: Replace the component class with the presentational version**

Replace the full contents of `church-groups-list.component.ts` with:

```typescript
import {
  Component, inject, signal, computed, DestroyRef, OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ChurchGroupsService,
  CATEGORY_CONFIG,
  FILTER_CATEGORIES,
  ChurchGroupMatrix,
} from '../church-groups.service';
import { MemberSummary, ChurchGroupSummary } from '../../../core/models/member.model';

@Component({
  selector: 'app-church-groups-list',
  standalone: true,
  imports: [],
  templateUrl: './church-groups-list.component.html',
})
export class ChurchGroupsListComponent implements OnInit {
  private readonly service = inject(ChurchGroupsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);

  private members = signal<MemberSummary[]>([]);
  private groups = signal<ChurchGroupSummary[]>([]);

  readonly matrix = computed<ChurchGroupMatrix>(() =>
    this.service.buildMatrix(this.members(), this.groups()),
  );

  readonly rowIndices = computed<number[]>(() =>
    Array.from({ length: this.matrix().rowCount }, (_, i) => i),
  );

  readonly filterCategories = FILTER_CATEGORIES;
  readonly categoryConfig = CATEGORY_CONFIG;

  ngOnInit(): void {
    this.service
      .loadDashboardData()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ members, groups }) => {
          this.members.set(members);
          this.groups.set(groups);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
```

- [ ] **Step 2: Verify the project compiles**

Run: `npm run build`
Expected: SUCCESS (no AG Grid / `GroupMemberCellComponent` references remain in this component; the template is rebuilt in Task 3 so it may still reference old bindings — if the build fails only on template bindings, proceed to Task 3 and re-run there).

- [ ] **Step 3: Commit**

```bash
git add src/app/features/church-groups/church-groups-list/church-groups-list.component.ts
git commit -m "refactor(church-groups): drop AG Grid from list component"
```

---

### Task 3: Rebuild the template as legend + HTML table

**Files:**
- Modify: `src/app/features/church-groups/church-groups-list/church-groups-list.component.html`

- [ ] **Step 1: Replace the template with the table layout**

Replace the full contents of `church-groups-list.component.html` with:

```html
<div class="flex flex-col gap-4 p-6">
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-bold text-gray-900">Church Groups</h1>
  </div>

  <!-- Legend box (above the table) -->
  <div class="inline-flex flex-col gap-1 rounded-md border border-gray-200 bg-white p-3 w-fit">
    @for (cat of filterCategories; track cat) {
      <div class="flex items-center gap-2">
        <span
          class="inline-block w-4 h-4 rounded-sm border border-gray-200"
          [style.background-color]="categoryConfig[cat].color"></span>
        <span class="text-xs text-gray-700">{{ categoryConfig[cat].label }}</span>
      </div>
    }
  </div>

  @if (loading()) {
    <div class="flex items-center justify-center h-48 text-gray-400 text-sm">
      불러오는 중...
    </div>
  } @else {
    <div class="overflow-x-auto">
      <table class="cg-table">
        <thead>
          <!-- Row 1: divisions -->
          <tr>
            <th class="cg-corner"></th>
            @for (div of matrix().divisions; track div.division) {
              <th class="cg-division" [attr.colspan]="div.groups.length">{{ div.division }}</th>
            }
            <th class="cg-newcomers-head" rowspan="3">새가족순</th>
          </tr>
          <!-- Row 2: 순 names -->
          <tr>
            <th class="cg-idx-label">순</th>
            @for (div of matrix().divisions; track div.division) {
              @for (group of div.groups; track group.publicId) {
                <th class="cg-group">{{ group.name }}</th>
              }
            }
          </tr>
          <!-- Row 3: 순장 names -->
          <tr>
            <th class="cg-idx-label">순장</th>
            @for (div of matrix().divisions; track div.division) {
              @for (group of div.groups; track group.publicId) {
                <th class="cg-leader">{{ group.leader }}</th>
              }
            }
          </tr>
        </thead>
        <tbody>
          @for (i of rowIndices(); track i) {
            <tr>
              <td class="cg-idx-cell">{{ i + 1 }}</td>
              @for (div of matrix().divisions; track div.division) {
                @for (group of div.groups; track group.publicId) {
                  @if (group.members[i]; as cell) {
                    <td class="cg-cell" [style.background-color]="categoryConfig[cell.category].color">{{ cell.displayName }}</td>
                  } @else {
                    <td class="cg-cell cg-empty"></td>
                  }
                }
              }
              @if (matrix().newcomers[i]; as cell) {
                <td class="cg-cell cg-center" [style.background-color]="categoryConfig[cell.category].color">{{ cell.displayName }}</td>
              } @else {
                <td class="cg-cell cg-empty"></td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  }
</div>
```

- [ ] **Step 2: Add table styles**

Add a `styleUrl` is not present; use an inline `styles` block instead. Open `church-groups-list.component.ts` and add a `styles` array to the `@Component` decorator (alongside `templateUrl`):

```typescript
  templateUrl: './church-groups-list.component.html',
  styles: [`
    .cg-table { border-collapse: collapse; font-size: 11px; table-layout: fixed; }
    .cg-table th, .cg-table td {
      border: 1px solid #e5e7eb;
      padding: 2px 6px;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cg-table th { background: #f9fafb; font-weight: 700; }
    .cg-corner { background: #fff; }
    .cg-group, .cg-leader, .cg-cell, .cg-newcomers-head { width: 90px; }
    .cg-idx-label, .cg-idx-cell { width: 36px; }
    .cg-cell { text-align: left; height: 24px; }
    .cg-center { text-align: center; }
    .cg-empty { background: #fafafa; }
  `],
```

- [ ] **Step 3: Verify the build succeeds**

Run: `npm run build`
Expected: SUCCESS, no template binding errors.

- [ ] **Step 4: Run the app and visually confirm against the image**

Run: `npm start`
Open the Church Groups page. Confirm:
- 3-level header (division colspan over 순 names over 순장).
- Colored cells per category; empty slots blank.
- 새가족순 column on the right.
- Legend box above the table.
- **Decision point:** if the target image shows NO row numbers in the left index column, change `<td class="cg-idx-cell">{{ i + 1 }}</td>` to `<td class="cg-idx-cell"></td>`.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/church-groups/church-groups-list/church-groups-list.component.html src/app/features/church-groups/church-groups-list/church-groups-list.component.ts
git commit -m "feat(church-groups): render group matrix as static HTML table"
```

---

### Task 4: Drop the AG Grid dependency if unused elsewhere

**Files:**
- Modify: `package.json` (only if no other feature imports AG Grid)

- [ ] **Step 1: Check whether AG Grid is still referenced anywhere**

Run: `grep -rn "ag-grid" src/`
Expected: no matches outside `cells/group-member-cell.component.ts` (dormant). If `group-member-cell.component.ts` is the only match and it is not imported anywhere, AG Grid is removable.

- [ ] **Step 2: Decide and act**

- If AG Grid is referenced ONLY by the dormant cell component and you want to keep that component for the later interactivity pass: leave `package.json` as-is (the dependency stays). **Skip the rest of this task.**
- If you want a clean tree now: delete `src/app/features/church-groups/church-groups-list/cells/group-member-cell.component.ts`, then remove `ag-grid-angular` and `ag-grid-community` from `package.json` dependencies and run `npm install`.

- [ ] **Step 3: Verify build + tests still pass**

Run: `npm run build && npm test -- --watch=false --browsers=ChromeHeadless`
Expected: SUCCESS / all specs PASS.

- [ ] **Step 4: Commit (only if changes were made)**

```bash
git add -A
git commit -m "chore(church-groups): remove unused AG Grid dependency"
```

---

## Self-Review

**Spec coverage:**
- §2 decision (HTML table, reuse service) → Tasks 1–3. ✓
- §4 data model refactor (`ChurchGroupMatrix`, leader lookup into service) → Task 1. ✓
- §5 table structure (3-level headers, colspan, 새가족순, fixed width) → Task 3. ✓
- §6 component changes (strip AG Grid, `matrix` computed) → Task 2. ✓
- §7 legend box above table → Task 3 Step 1. ✓
- §8 testing (spec rewrite, presentational component) → Task 1; component is presentational, render confirmed manually in Task 3 Step 4. ✓
- §3 deferred interactions → not implemented by design; dormant cell component handling → Task 4. ✓

**Placeholder scan:** No TBD/TODO; the one decision point (index row numbers vs. blank) carries the concrete edit to make. ✓

**Type consistency:** `ChurchGroupMatrix` / `DivisionGroup` / `GroupColumn` / `MatrixCell` names and the `buildMatrix(members, groups)` signature match across service, spec, component, and template. `categoryConfig[cell.category].color` matches `CATEGORY_CONFIG` shape. ✓
