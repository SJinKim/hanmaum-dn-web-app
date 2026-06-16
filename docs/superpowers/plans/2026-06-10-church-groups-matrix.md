# Church Groups Matrix Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Church Groups page with an AG-Grid pivot/matrix view showing all active members organized by group columns, color-coded by discipleship category, with multi-select filter toggle buttons and inline admin flag editing.

**Architecture:** Extend the existing `PATCH /members/{id}` and `GET /members` endpoints with two new boolean fields (`isNextGroupLeader`, `oneOnOneSignupFilled`). The frontend fetches all active members plus church groups in parallel, computes each member's discipleship category client-side, and pivots the data into a dynamically-generated AG-Grid column structure.

**Tech Stack:** Kotlin/Spring Boot (backend), Angular 21 standalone components, AG-Grid Community 35, PrimeNG 21, Tailwind CSS, Flyway migrations, Jasmine/TestBed (frontend tests), JUnit 5 (backend tests).

---

## File Map

**Backend — hanmaum-dn-server**
| Action | Path |
|--------|------|
| Create | `src/main/resources/db/migration/V20260610020000__add_member_group_flags.sql` |
| Modify | `src/main/kotlin/com/hanmaum/dn/app/features/members/domain/Member.kt` |
| Modify | `src/main/kotlin/com/hanmaum/dn/app/features/members/api/v1/dto/MemberDtos.kt` |
| Modify | `src/main/kotlin/com/hanmaum/dn/app/features/members/api/MemberMappers.kt` |
| Modify | `src/test/kotlin/com/hanmaum/dn/app/features/members/api/MemberMappersTest.kt` |

**Frontend — hanmaum-dn-web-app**
| Action | Path |
|--------|------|
| Modify | `src/app/core/models/member.model.ts` |
| Create | `src/app/features/church-groups/church-groups.service.ts` |
| Create | `src/app/features/church-groups/church-groups.service.spec.ts` |
| Create | `src/app/features/church-groups/church-groups.routes.ts` |
| Create | `src/app/features/church-groups/church-groups-list/cells/group-member-cell.component.ts` |
| Create | `src/app/features/church-groups/church-groups-list/church-groups-list.component.ts` |
| Create | `src/app/features/church-groups/church-groups-list/church-groups-list.component.html` |
| Modify | `src/app/app.routes.ts` |
| Modify | `src/app/shell/sidebar/sidebar.component.ts` |

---

## Task 1: DB Migration

**Files:**
- Create: `hanmaum-dn-server/src/main/resources/db/migration/V20260610020000__add_member_group_flags.sql`

- [ ] **Step 1: Create the migration file**

```sql
ALTER TABLE members
    ADD COLUMN is_next_group_leader     BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN one_on_one_signup_filled BOOLEAN NOT NULL DEFAULT FALSE;
```

- [ ] **Step 2: Verify the file is picked up**

Start the server once (or run `./gradlew bootRun` in `hanmaum-dn-server`). Flyway applies migrations on startup. Look for `Successfully applied 1 migration` in the logs. Stop the server after verification.

- [ ] **Step 3: Commit**

```bash
git add src/main/resources/db/migration/V20260610020000__add_member_group_flags.sql
git commit -m "feat(members): add is_next_group_leader and one_on_one_signup_filled columns"
```

---

## Task 2: Member Entity — add two boolean fields

**Files:**
- Modify: `src/main/kotlin/com/hanmaum/dn/app/features/members/domain/Member.kt`

- [ ] **Step 1: Add the two fields at the end of the constructor parameter list, before `) : BaseEntity()`**

Open `Member.kt`. After the `profileImageUrl` parameter (line 68), add:

```kotlin
    // --- DASHBOARD FLAGS ---
    @Column(name = "is_next_group_leader", nullable = false)
    var isNextGroupLeader: Boolean = false,
    @Column(name = "one_on_one_signup_filled", nullable = false)
    var oneOnOneSignupFilled: Boolean = false,
) : BaseEntity() {
```

The complete closing of the constructor + class body should look like:

```kotlin
    @Column(name = "profile_image_url", length = 500)
    var profileImageUrl: String? = null,
    // --- DASHBOARD FLAGS ---
    @Column(name = "is_next_group_leader", nullable = false)
    var isNextGroupLeader: Boolean = false,
    @Column(name = "one_on_one_signup_filled", nullable = false)
    var oneOnOneSignupFilled: Boolean = false,
) : BaseEntity() {
    fun getFullName(): String = "$lastName$firstName"
}
```

- [ ] **Step 2: Verify the project compiles**

```bash
cd hanmaum-dn-server
./gradlew compileKotlin
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Commit**

```bash
git add src/main/kotlin/com/hanmaum/dn/app/features/members/domain/Member.kt
git commit -m "feat(members): add isNextGroupLeader and oneOnOneSignupFilled to Member entity"
```

---

## Task 3: Member DTOs — MemberSummaryDto, MemberDto, UpdateMemberRequest

**Files:**
- Modify: `src/main/kotlin/com/hanmaum/dn/app/features/members/api/v1/dto/MemberDtos.kt`

- [ ] **Step 1: Add `groupPublicId` and the two new flags to `MemberSummaryDto`**

`MemberSummaryDto` currently ends with `activeMinistries`. Add three fields:

```kotlin
data class MemberSummaryDto(
    val publicId: String,
    val lastName: String,
    val firstName: String,
    val email: String? = null,
    val memberStatus: String,
    val baptism: String? = null,
    val groupPublicId: String? = null,          // ← add
    val groupName: String? = null,
    val updatedAt: Instant? = null,
    val latestTraining: String? = null,
    val trainings: List<SummaryTrainingDto> = emptyList(),
    val activeMinistries: List<String> = emptyList(),
    val isNextGroupLeader: Boolean = false,      // ← add
    val oneOnOneSignupFilled: Boolean = false,   // ← add
)
```

- [ ] **Step 2: Add the two new flags to `MemberDto`**

`MemberDto` currently ends with `ministries`. Add:

```kotlin
data class MemberDto(
    val publicId: String,
    val lastName: String,
    val firstName: String,
    val discriminator: String? = null,
    val gender: String? = null,
    val baptism: String? = null,
    val birthDate: LocalDate? = null,
    val phoneNumber: String? = null,
    val email: String? = null,
    val street: String? = null,
    val houseNumber: String? = null,
    val zipCode: String? = null,
    val city: String? = null,
    val registrationDate: LocalDate? = null,
    val memberStatus: String,
    val churchRole: String? = null,
    val groupPublicId: String? = null,
    val groupName: String? = null,
    val profileImageUrl: String? = null,
    val trainings: List<UserTrainingDto> = emptyList(),
    val ministries: List<MinistryHistoryDto> = emptyList(),
    val isNextGroupLeader: Boolean = false,      // ← add
    val oneOnOneSignupFilled: Boolean = false,   // ← add
)
```

- [ ] **Step 3: Add the two new optional fields to `UpdateMemberRequest`**

```kotlin
data class UpdateMemberRequest(
    val lastName: String? = null,
    val firstName: String? = null,
    val discriminator: String? = null,
    val gender: String? = null,
    val baptism: String? = null,
    val birthDate: LocalDate? = null,
    @field:Size(max = 50)
    val phoneNumber: String? = null,
    @field:Email
    val email: String? = null,
    val street: String? = null,
    @field:Size(max = 50)
    val houseNumber: String? = null,
    val zipCode: String? = null,
    val city: String? = null,
    val registrationDate: LocalDate? = null,
    val memberStatus: String? = null,
    val churchRole: String? = null,
    val groupPublicId: String? = null,
    val profileImageUrl: String? = null,
    val isNextGroupLeader: Boolean? = null,      // ← add
    val oneOnOneSignupFilled: Boolean? = null,   // ← add
)
```

- [ ] **Step 4: Compile**

```bash
./gradlew compileKotlin
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/hanmaum/dn/app/features/members/api/v1/dto/MemberDtos.kt
git commit -m "feat(members): add groupPublicId and group-flag fields to member DTOs"
```

---

## Task 4: MemberMappers — wire the new fields

**Files:**
- Modify: `src/main/kotlin/com/hanmaum/dn/app/features/members/api/MemberMappers.kt`

- [ ] **Step 1: Add the two flag fields to `applyPatch`**

In `applyPatch`, after the `request.profileImageUrl?.let { ... }` line (line 97) and before the `request.memberStatus?.let { ... }` block, add:

```kotlin
    request.isNextGroupLeader?.let { this.isNextGroupLeader = it }
    request.oneOnOneSignupFilled?.let { this.oneOnOneSignupFilled = it }
```

- [ ] **Step 2: Add all three new fields to `toSummaryDto`**

The `toSummaryDto` function currently maps to `MemberSummaryDto(...)`. Add `groupPublicId`, `isNextGroupLeader`, and `oneOnOneSignupFilled`:

```kotlin
fun Member.toSummaryDto(
    latestTraining: String? = null,
    trainings: List<SummaryTrainingDto> = emptyList(),
    activeMinistries: List<String> = emptyList(),
): MemberSummaryDto =
    MemberSummaryDto(
        publicId = this.publicId.toString(),
        lastName = this.lastName,
        firstName = this.firstName,
        email = this.email,
        memberStatus = this.memberStatus.name,
        baptism = this.baptism?.name,
        groupPublicId = this.group?.publicId?.toString(),   // ← add
        groupName = this.group?.name,
        updatedAt = this.updatedAt,
        latestTraining = latestTraining,
        trainings = trainings,
        activeMinistries = activeMinistries,
        isNextGroupLeader = this.isNextGroupLeader,         // ← add
        oneOnOneSignupFilled = this.oneOnOneSignupFilled,   // ← add
    )
```

- [ ] **Step 3: Add the two flag fields to `toDto`**

In the `toDto` function, after `ministries = ministries,` add:

```kotlin
        isNextGroupLeader = this.isNextGroupLeader,
        oneOnOneSignupFilled = this.oneOnOneSignupFilled,
```

- [ ] **Step 4: Compile**

```bash
./gradlew compileKotlin
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: Commit**

```bash
git add src/main/kotlin/com/hanmaum/dn/app/features/members/api/MemberMappers.kt
git commit -m "feat(members): map isNextGroupLeader and oneOnOneSignupFilled in member mappers"
```

---

## Task 5: Backend tests — applyPatch and toSummaryDto with new fields

**Files:**
- Modify: `src/test/kotlin/com/hanmaum/dn/app/features/members/api/MemberMappersTest.kt`

- [ ] **Step 1: Write failing tests — add to the end of `MemberMappersTest` class**

```kotlin
    // --- isNextGroupLeader / oneOnOneSignupFilled ---

    @Test
    fun `applyPatch sets isNextGroupLeader when provided`() {
        val member = memberWithId(1L)
        member.applyPatch(UpdateMemberRequest(isNextGroupLeader = true))
        assertEquals(true, member.isNextGroupLeader)
    }

    @Test
    fun `applyPatch sets oneOnOneSignupFilled when provided`() {
        val member = memberWithId(1L)
        member.applyPatch(UpdateMemberRequest(oneOnOneSignupFilled = true))
        assertEquals(true, member.oneOnOneSignupFilled)
    }

    @Test
    fun `applyPatch does not change isNextGroupLeader when null`() {
        val member = memberWithId(1L)
        member.isNextGroupLeader = true
        member.applyPatch(UpdateMemberRequest(lastName = "박"))
        assertEquals(true, member.isNextGroupLeader)
    }

    @Test
    fun `toSummaryDto includes groupPublicId from group`() {
        val group = ChurchGroup(name = "믿음")
        // Assign a UUID to the group via BaseEntity reflection
        val pubId = java.util.UUID.randomUUID()
        val pubIdField = group.javaClass.superclass.getDeclaredField("publicId")
        pubIdField.isAccessible = true
        pubIdField.set(group, pubId)

        val member = memberWithId(1L)
        member.group = group

        val dto = member.toSummaryDto()
        assertEquals(pubId.toString(), dto.groupPublicId)
    }

    @Test
    fun `toSummaryDto maps isNextGroupLeader and oneOnOneSignupFilled`() {
        val member = memberWithId(1L)
        member.isNextGroupLeader = true
        member.oneOnOneSignupFilled = true
        val dto = member.toSummaryDto()
        assertEquals(true, dto.isNextGroupLeader)
        assertEquals(true, dto.oneOnOneSignupFilled)
    }
```

- [ ] **Step 2: Run tests to verify they fail first**

```bash
./gradlew test --tests "com.hanmaum.dn.app.features.members.api.MemberMappersTest" --no-verify
```

Expected: tests fail because the fields don't exist yet on the entity/DTOs (you've already done Tasks 2–4, so they should PASS — if running after Task 4 they'll pass immediately; run this step before Task 4 if you want the red-green cycle).

- [ ] **Step 3: Run tests after Tasks 2–4 are done**

```bash
./gradlew test --tests "com.hanmaum.dn.app.features.members.api.MemberMappersTest" --no-verify
```

Expected: `BUILD SUCCESSFUL`, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/test/kotlin/com/hanmaum/dn/app/features/members/api/MemberMappersTest.kt
git commit -m "test(members): verify applyPatch and toSummaryDto with group flag fields"
```

---

## Task 6: Frontend model — add new fields to member interfaces

**Files:**
- Modify: `src/app/core/models/member.model.ts`

- [ ] **Step 1: Add `groupPublicId` and two flag fields to `MemberSummary`**

In `member.model.ts`, the `MemberSummary` interface currently ends with `activeMinistries`. Add three fields:

```typescript
export interface MemberSummary {
  publicId: string;
  lastName: string;
  firstName: string;
  email: string | null;
  memberStatus: MemberStatus;
  baptism: Baptism | null;
  groupPublicId?: string | null;    // ← add
  groupName: string | null;
  role?: 'ADMIN' | 'MEMBER';
  updatedAt?: string;
  latestTraining?: string | null;
  trainings?: SummaryTraining[];
  activeMinistries?: string[];
  isNextGroupLeader?: boolean;      // ← add
  oneOnOneSignupFilled?: boolean;   // ← add
}
```

- [ ] **Step 2: Add the two flag fields to `Member`**

In the `Member` interface, after `profileImageUrl`:

```typescript
  profileImageUrl: string | null;
  isNextGroupLeader?: boolean;      // ← add
  oneOnOneSignupFilled?: boolean;   // ← add
  trainings?: UserTraining[];
  ministries?: MinistryHistory[];
```

- [ ] **Step 3: Add the two flag fields to `UpdateMemberRequest`**

```typescript
export interface UpdateMemberRequest {
  lastName?: string;
  firstName?: string;
  discriminator?: string;
  gender?: Gender;
  baptism?: Baptism;
  birthDate?: string;
  phoneNumber?: string;
  email?: string;
  street?: string;
  houseNumber?: string;
  zipCode?: string;
  city?: string;
  registrationDate?: string;
  memberStatus?: MemberStatus;
  churchRole?: string;
  groupPublicId?: string;
  profileImageUrl?: string;
  isNextGroupLeader?: boolean;      // ← add
  oneOnOneSignupFilled?: boolean;   // ← add
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/core/models/member.model.ts
git commit -m "feat(church-groups): add groupPublicId and flag fields to frontend member model"
```

---

## Task 7: Church Groups Service

**Files:**
- Create: `src/app/features/church-groups/church-groups.service.ts`

- [ ] **Step 1: Create the service file**

```typescript
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { MemberService } from '../members/member.service';
import { MemberSummary, ChurchGroupSummary } from '../../core/models/member.model';
import { SummaryTraining } from '../../core/models/member-activity.model';

export type MemberCategory =
  | 'NEXT_LEADER'
  | 'ONE_ON_ONE_IN_PROGRESS'
  | 'ONE_ON_ONE_WAITING'
  | 'QBS_COMPLETED'
  | 'DISCIPLESHIP_COMPLETED'
  | 'UNBAPTIZED'
  | 'DEFAULT';

export interface CategoryConfig {
  label: string;
  color: string;
}

export const CATEGORY_CONFIG: Record<MemberCategory, CategoryConfig> = {
  NEXT_LEADER:            { label: '예비순장',         color: '#f9a8d4' },
  ONE_ON_ONE_IN_PROGRESS: { label: '일대일진행',       color: '#bbf7d0' },
  ONE_ON_ONE_WAITING:     { label: '일대일대기',       color: '#fef08a' },
  QBS_COMPLETED:          { label: '큐비세수료',       color: '#bae6fd' },
  DISCIPLESHIP_COMPLETED: { label: '제자반수료',       color: '#ffffff' },
  UNBAPTIZED:             { label: '세레X / 확인대상', color: '#fed7aa' },
  DEFAULT:                { label: '',                 color: '#f9fafb' },
};

export const FILTER_CATEGORIES: MemberCategory[] = [
  'NEXT_LEADER',
  'ONE_ON_ONE_IN_PROGRESS',
  'ONE_ON_ONE_WAITING',
  'QBS_COMPLETED',
  'DISCIPLESHIP_COMPLETED',
  'UNBAPTIZED',
];

export interface MatrixCell {
  publicId: string;
  displayName: string;
  category: MemberCategory;
  isNextGroupLeader: boolean;
  oneOnOneSignupFilled: boolean;
}

export type MatrixRow = Record<string, MatrixCell | null>;

@Injectable({ providedIn: 'root' })
export class ChurchGroupsService {
  private readonly memberService = inject(MemberService);

  loadDashboardData(): Observable<{ members: MemberSummary[]; groups: ChurchGroupSummary[] }> {
    return forkJoin({
      members: this.memberService
        .getMembers({ status: 'ACTIVE', size: 9999 })
        .pipe(map(p => p.content)),
      groups: this.memberService.getChurchGroups(),
    });
  }

  computeCategory(member: MemberSummary): MemberCategory {
    if (member.isNextGroupLeader) return 'NEXT_LEADER';

    const trainings: SummaryTraining[] = member.trainings ?? [];
    const has = (name: string, status: string): boolean =>
      trainings.some(
        t => t.name.toLowerCase().includes(name.toLowerCase()) && t.status === status,
      );

    if (has('일대일', 'IN_PROGRESS')) return 'ONE_ON_ONE_IN_PROGRESS';
    if (has('QBS', 'COMPLETED') && member.oneOnOneSignupFilled) return 'ONE_ON_ONE_WAITING';
    if (has('QBS', 'COMPLETED')) return 'QBS_COMPLETED';
    if (has('제자반', 'COMPLETED')) return 'DISCIPLESHIP_COMPLETED';
    if (!member.baptism || member.baptism === 'UNBAPTIZED') return 'UNBAPTIZED';
    return 'DEFAULT';
  }

  buildMatrix(members: MemberSummary[], groups: ChurchGroupSummary[]): MatrixRow[] {
    const groupMap = new Map<string, MatrixCell[]>();
    for (const g of groups) groupMap.set(g.publicId, []);

    for (const m of members) {
      if (!m.groupPublicId || !groupMap.has(m.groupPublicId)) continue;
      groupMap.get(m.groupPublicId)!.push({
        publicId: m.publicId,
        displayName: m.lastName + m.firstName,
        category: this.computeCategory(m),
        isNextGroupLeader: m.isNextGroupLeader ?? false,
        oneOnOneSignupFilled: m.oneOnOneSignupFilled ?? false,
      });
    }

    const maxLen = Math.max(0, ...Array.from(groupMap.values()).map(a => a.length));
    const rows: MatrixRow[] = [];
    for (let i = 0; i < maxLen; i++) {
      const row: MatrixRow = {};
      for (const [pubId, cells] of groupMap) {
        row[`grp_${pubId}`] = cells[i] ?? null;
      }
      rows.push(row);
    }
    return rows;
  }

  patchMemberFlags(
    publicId: string,
    patch: { isNextGroupLeader?: boolean; oneOnOneSignupFilled?: boolean },
  ): Observable<void> {
    return this.memberService.updateMember(publicId, patch).pipe(map(() => undefined));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/church-groups/church-groups.service.ts
git commit -m "feat(church-groups): add ChurchGroupsService with category computation and matrix builder"
```

---

## Task 8: Church Groups Service — unit tests

**Files:**
- Create: `src/app/features/church-groups/church-groups.service.spec.ts`

- [ ] **Step 1: Write tests for `computeCategory` and `buildMatrix`**

```typescript
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ChurchGroupsService } from './church-groups.service';
import { MemberSummary } from '../../core/models/member.model';
import { ChurchGroupSummary } from '../../core/models/member.model';

function makeMember(overrides: Partial<MemberSummary> = {}): MemberSummary {
  return {
    publicId: 'pub-1',
    lastName: '김',
    firstName: '철수',
    email: null,
    memberStatus: 'ACTIVE',
    baptism: 'GENERAL_BAPTIZED',
    groupName: null,
    ...overrides,
  };
}

describe('ChurchGroupsService', () => {
  let service: ChurchGroupsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ChurchGroupsService);
  });

  describe('computeCategory', () => {
    it('returns NEXT_LEADER when isNextGroupLeader is true', () => {
      expect(service.computeCategory(makeMember({ isNextGroupLeader: true }))).toBe('NEXT_LEADER');
    });

    it('NEXT_LEADER overrides any training status', () => {
      const m = makeMember({
        isNextGroupLeader: true,
        trainings: [{ name: '일대일', status: 'IN_PROGRESS' }],
      });
      expect(service.computeCategory(m)).toBe('NEXT_LEADER');
    });

    it('returns ONE_ON_ONE_IN_PROGRESS when 일대일 is IN_PROGRESS', () => {
      const m = makeMember({ trainings: [{ name: '일대일', status: 'IN_PROGRESS' }] });
      expect(service.computeCategory(m)).toBe('ONE_ON_ONE_IN_PROGRESS');
    });

    it('returns ONE_ON_ONE_WAITING when QBS COMPLETED and signup filled', () => {
      const m = makeMember({
        trainings: [{ name: 'QBS', status: 'COMPLETED' }],
        oneOnOneSignupFilled: true,
      });
      expect(service.computeCategory(m)).toBe('ONE_ON_ONE_WAITING');
    });

    it('returns QBS_COMPLETED when QBS COMPLETED but signup NOT filled', () => {
      const m = makeMember({
        trainings: [{ name: 'QBS', status: 'COMPLETED' }],
        oneOnOneSignupFilled: false,
      });
      expect(service.computeCategory(m)).toBe('QBS_COMPLETED');
    });

    it('returns DISCIPLESHIP_COMPLETED when 제자반 COMPLETED', () => {
      const m = makeMember({ trainings: [{ name: '제자반', status: 'COMPLETED' }] });
      expect(service.computeCategory(m)).toBe('DISCIPLESHIP_COMPLETED');
    });

    it('returns UNBAPTIZED when baptism is null', () => {
      expect(service.computeCategory(makeMember({ baptism: null }))).toBe('UNBAPTIZED');
    });

    it('returns UNBAPTIZED when baptism is UNBAPTIZED', () => {
      expect(service.computeCategory(makeMember({ baptism: 'UNBAPTIZED' }))).toBe('UNBAPTIZED');
    });

    it('returns DEFAULT when baptized and no matching trainings', () => {
      expect(service.computeCategory(makeMember({ baptism: 'GENERAL_BAPTIZED' }))).toBe('DEFAULT');
    });

    it('QBS IN_PROGRESS does not trigger QBS_COMPLETED', () => {
      const m = makeMember({ trainings: [{ name: 'QBS', status: 'IN_PROGRESS' }] });
      expect(service.computeCategory(m)).not.toBe('QBS_COMPLETED');
    });
  });

  describe('buildMatrix', () => {
    const group1: ChurchGroupSummary = { publicId: 'g1', division: '느헤미야', name: '믿음' };
    const group2: ChurchGroupSummary = { publicId: 'g2', division: '느헤미야', name: '소망' };

    it('returns empty array when no members', () => {
      const rows = service.buildMatrix([], [group1]);
      expect(rows).toEqual([]);
    });

    it('places members in correct group column', () => {
      const m = makeMember({ groupPublicId: 'g1' });
      const rows = service.buildMatrix([m], [group1, group2]);
      expect(rows.length).toBe(1);
      expect(rows[0]['grp_g1']).toBeTruthy();
      expect(rows[0]['grp_g2']).toBeNull();
    });

    it('row count equals the largest group size', () => {
      const members = [
        makeMember({ publicId: 'a', groupPublicId: 'g1' }),
        makeMember({ publicId: 'b', groupPublicId: 'g1' }),
        makeMember({ publicId: 'c', groupPublicId: 'g2' }),
      ];
      const rows = service.buildMatrix(members, [group1, group2]);
      expect(rows.length).toBe(2);
      expect(rows[1]['grp_g2']).toBeNull();
    });

    it('ignores members with no groupPublicId', () => {
      const m = makeMember({ groupPublicId: null });
      const rows = service.buildMatrix([m], [group1]);
      expect(rows).toEqual([]);
    });

    it('cell displayName is lastName+firstName', () => {
      const m = makeMember({ publicId: 'x', groupPublicId: 'g1', lastName: '이', firstName: '영희' });
      const rows = service.buildMatrix([m], [group1]);
      expect(rows[0]['grp_g1']?.displayName).toBe('이영희');
    });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd hanmaum-dn-web-app
npx ng test --include="**/church-groups.service.spec.ts" --watch=false
```

Expected: all 14 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/church-groups/church-groups.service.spec.ts
git commit -m "test(church-groups): unit tests for computeCategory and buildMatrix"
```

---

## Task 9: Group Member Cell Renderer

**Files:**
- Create: `src/app/features/church-groups/church-groups-list/cells/group-member-cell.component.ts`

- [ ] **Step 1: Create the cell renderer**

```typescript
import { Component, ViewChild } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { FormsModule } from '@angular/forms';
import { Popover } from 'primeng/popover';
import { CheckboxModule } from 'primeng/checkbox';
import { MatrixCell, MemberCategory, CATEGORY_CONFIG } from '../../church-groups.service';

interface CellContext {
  activeFilters: () => Set<MemberCategory>;
  patchFlags: (publicId: string, patch: { isNextGroupLeader?: boolean; oneOnOneSignupFilled?: boolean }) => void;
}

@Component({
  selector: 'app-group-member-cell',
  standalone: true,
  imports: [FormsModule, Popover, CheckboxModule],
  template: `
    @if (cell) {
      <div
        class="member-cell"
        [style.background-color]="bgColor"
        [style.opacity]="isVisible ? '1' : '0.15'"
        (click)="pop.toggle($event)">
        {{ cell.displayName }}
      </div>
      <p-popover #pop>
        <div class="flex flex-col gap-3 p-1 min-w-36">
          <p-checkbox
            [(ngModel)]="cell.isNextGroupLeader"
            [binary]="true"
            label="예비순장"
            (onChange)="onFlagChange('isNextGroupLeader', $event.checked)" />
          <p-checkbox
            [(ngModel)]="cell.oneOnOneSignupFilled"
            [binary]="true"
            label="일대일 신청서 제출"
            (onChange)="onFlagChange('oneOnOneSignupFilled', $event.checked)" />
        </div>
      </p-popover>
    } @else {
      <div class="empty-cell"></div>
    }
  `,
  styles: [`
    :host { display: flex; align-items: stretch; height: 100%; }
    .member-cell {
      cursor: pointer;
      padding: 2px 6px;
      font-size: 11px;
      width: 100%;
      display: flex;
      align-items: center;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      border: 1px solid #e5e7eb;
      transition: opacity 0.15s;
    }
    .empty-cell {
      width: 100%;
      background: #fafafa;
      border: 1px solid #f3f4f6;
    }
  `],
})
export class GroupMemberCellComponent implements ICellRendererAngularComp {
  @ViewChild('pop') pop!: Popover;

  cell: MatrixCell | null = null;
  bgColor = '#f9fafb';
  isVisible = true;

  private context!: CellContext;

  agInit(params: ICellRendererParams<MatrixRow, MatrixCell | null> & { context: CellContext }): void {
    this.update(params);
  }

  refresh(params: ICellRendererParams<MatrixRow, MatrixCell | null> & { context: CellContext }): boolean {
    this.update(params);
    return true;
  }

  private update(params: ICellRendererParams & { context: CellContext }): void {
    this.cell = params.value as MatrixCell | null;
    this.context = params.context;
    if (this.cell) {
      this.bgColor = CATEGORY_CONFIG[this.cell.category].color;
      const filters = this.context.activeFilters();
      this.isVisible = filters.size === 0 || filters.has(this.cell.category);
    }
  }

  onFlagChange(
    flag: 'isNextGroupLeader' | 'oneOnOneSignupFilled',
    value: boolean,
  ): void {
    if (!this.cell) return;
    this.context.patchFlags(this.cell.publicId, { [flag]: value });
    if (flag === 'isNextGroupLeader') {
      this.cell = { ...this.cell, isNextGroupLeader: value };
      this.bgColor = value
        ? CATEGORY_CONFIG['NEXT_LEADER'].color
        : CATEGORY_CONFIG[this.cell.category].color;
    }
  }
}
```

> **Note:** `MatrixRow` is imported from the service. Add `import type { MatrixRow } from '../../church-groups.service';` at the top of this file alongside the other imports.

- [ ] **Step 2: Fix the import — the full import block at the top of the file is**

```typescript
import { Component, ViewChild } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { FormsModule } from '@angular/forms';
import { Popover } from 'primeng/popover';
import { CheckboxModule } from 'primeng/checkbox';
import { MatrixCell, MatrixRow, MemberCategory, CATEGORY_CONFIG } from '../../church-groups.service';
```

- [ ] **Step 3: Commit**

```bash
git add src/app/features/church-groups/church-groups-list/cells/group-member-cell.component.ts
git commit -m "feat(church-groups): add GroupMemberCellComponent with flag overlay"
```

---

## Task 10: Church Groups List Component

**Files:**
- Create: `src/app/features/church-groups/church-groups-list/church-groups-list.component.ts`
- Create: `src/app/features/church-groups/church-groups-list/church-groups-list.component.html`

- [ ] **Step 1: Create the component TypeScript file**

```typescript
import {
  Component, inject, signal, computed, DestroyRef, OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef, ColGroupDef, GridApi, GridReadyEvent, GridOptions,
  ModuleRegistry, AllCommunityModule, themeQuartz,
} from 'ag-grid-community';
import { ButtonModule } from 'primeng/button';
import {
  ChurchGroupsService,
  MemberCategory,
  CATEGORY_CONFIG,
  FILTER_CATEGORIES,
  MatrixRow,
} from '../church-groups.service';
import { MemberSummary, ChurchGroupSummary } from '../../../core/models/member.model';
import { GroupMemberCellComponent } from './cells/group-member-cell.component';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: 'app-church-groups-list',
  standalone: true,
  imports: [AgGridAngular, ButtonModule],
  templateUrl: './church-groups-list.component.html',
})
export class ChurchGroupsListComponent implements OnInit {
  private readonly service = inject(ChurchGroupsService);
  private readonly destroyRef = inject(DestroyRef);
  private gridApi?: GridApi;

  readonly theme = themeQuartz.withParams({
    fontFamily: 'Manrope, sans-serif',
    fontSize: 11,
    headerFontWeight: 700,
    headerBackgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
    cellHorizontalPadding: 0,
  });

  readonly loading = signal(true);
  readonly activeFilters = signal<Set<MemberCategory>>(new Set());

  private members = signal<MemberSummary[]>([]);
  private groups = signal<ChurchGroupSummary[]>([]);

  readonly rowData = computed<MatrixRow[]>(() =>
    this.service.buildMatrix(this.members(), this.groups()),
  );

  readonly columnDefs = computed<(ColDef | ColGroupDef)[]>(() =>
    this.buildColumnDefs(this.groups()),
  );

  readonly filterCategories = FILTER_CATEGORIES;
  readonly categoryConfig = CATEGORY_CONFIG;

  readonly gridOptions: GridOptions = {
    rowHeight: 36,
    headerHeight: 40,
    suppressMovableColumns: true,
    suppressCellFocus: true,
    domLayout: 'autoHeight',
    context: this.buildContext(),
  };

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

  onGridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
  }

  toggleFilter(category: MemberCategory): void {
    this.activeFilters.update(current => {
      const next = new Set(current);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });
    this.gridApi?.updateGridOptions({ context: this.buildContext() });
    this.gridApi?.refreshCells({ force: true });
  }

  isFilterActive(category: MemberCategory): boolean {
    return this.activeFilters().has(category);
  }

  private buildContext() {
    return {
      activeFilters: () => this.activeFilters(),
      patchFlags: (publicId: string, patch: { isNextGroupLeader?: boolean; oneOnOneSignupFilled?: boolean }) => {
        this.service
          .patchMemberFlags(publicId, patch)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.members.update(list =>
                list.map(m =>
                  m.publicId === publicId ? { ...m, ...patch } : m,
                ),
              );
            },
          });
      },
    };
  }

  private buildColumnDefs(groups: ChurchGroupSummary[]): (ColDef | ColGroupDef)[] {
    const byDivision = new Map<string, ChurchGroupSummary[]>();
    for (const g of groups) {
      const div = g.division ?? '';
      if (!byDivision.has(div)) byDivision.set(div, []);
      byDivision.get(div)!.push(g);
    }
    return Array.from(byDivision.entries()).map(([div, divGroups]) => ({
      headerName: div,
      children: divGroups.map(g => ({
        headerName: g.name,
        field: `grp_${g.publicId}`,
        width: 100,
        cellRenderer: GroupMemberCellComponent,
        sortable: false,
        filter: false,
        resizable: false,
      })),
    }));
  }
}
```

- [ ] **Step 2: Create the template file**

```html
<div class="flex flex-col gap-4 p-6">
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-bold text-gray-900">Church Groups</h1>
  </div>

  <!-- Filter toggle buttons -->
  <div class="flex flex-wrap gap-2 items-center">
    <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">Filter:</span>
    @for (cat of filterCategories; track cat) {
      <button
        type="button"
        class="px-3 py-1 rounded-full text-xs font-medium border transition-all"
        [style.background-color]="isFilterActive(cat) ? categoryConfig[cat].color : '#f3f4f6'"
        [style.border-color]="categoryConfig[cat].color"
        [style.opacity]="isFilterActive(cat) ? '1' : '0.6'"
        (click)="toggleFilter(cat)">
        {{ categoryConfig[cat].label }}
      </button>
    }
    @if (activeFilters().size > 0) {
      <button
        type="button"
        class="px-3 py-1 rounded-full text-xs font-medium border border-gray-300 text-gray-500 hover:bg-gray-50"
        (click)="activeFilters.set(new Set())">
        모두 보기
      </button>
    }
  </div>

  <!-- Legend -->
  <div class="flex flex-wrap gap-3">
    @for (cat of filterCategories; track cat) {
      <div class="flex items-center gap-1.5">
        <div
          class="w-3 h-3 rounded-sm border border-gray-200"
          [style.background-color]="categoryConfig[cat].color"></div>
        <span class="text-xs text-gray-600">{{ categoryConfig[cat].label }}</span>
      </div>
    }
  </div>

  <!-- Grid -->
  @if (loading()) {
    <div class="flex items-center justify-center h-48 text-gray-400 text-sm">
      불러오는 중...
    </div>
  } @else {
    <ag-grid-angular
      [theme]="theme"
      [rowData]="rowData()"
      [columnDefs]="columnDefs()"
      [gridOptions]="gridOptions"
      (gridReady)="onGridReady($event)"
      class="w-full" />
  }
</div>
```

- [ ] **Step 3: Fix the template — `new Set()` cannot be called directly in a template. Replace the "모두 보기" button's click handler**

In the template, change:
```html
(click)="activeFilters.set(new Set())"
```
to:
```html
(click)="clearFilters()"
```

And add this method to the component class:
```typescript
clearFilters(): void {
  this.activeFilters.set(new Set());
  this.gridApi?.updateGridOptions({ context: this.buildContext() });
  this.gridApi?.refreshCells({ force: true });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/church-groups/church-groups-list/
git commit -m "feat(church-groups): add ChurchGroupsListComponent with matrix grid and filter buttons"
```

---

## Task 11: Routes file, app.routes.ts, and sidebar

**Files:**
- Create: `src/app/features/church-groups/church-groups.routes.ts`
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/shell/sidebar/sidebar.component.ts`

- [ ] **Step 1: Create the routes file**

```typescript
import { Routes } from '@angular/router';
import { ChurchGroupsListComponent } from './church-groups-list/church-groups-list.component';

export const CHURCH_GROUPS_ROUTES: Routes = [
  { path: '', component: ChurchGroupsListComponent },
];
```

- [ ] **Step 2: Register the route in `app.routes.ts`**

Add after the `announcements` route and before the closing `]` of `children`:

```typescript
      {
        path: 'church-groups',
        loadChildren: () =>
          import('./features/church-groups/church-groups.routes')
            .then(m => m.CHURCH_GROUPS_ROUTES),
      },
```

The full `children` array becomes:

```typescript
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/home/home.component').then(m => m.HomeComponent),
      },
      {
        path: 'members',
        loadChildren: () =>
          import('./features/members/members.routes').then(m => m.MEMBERS_ROUTES),
      },
      {
        path: 'ministry',
        loadChildren: () =>
          import('./features/ministry/ministry.routes').then(m => m.MINISTRY_ROUTES),
      },
      {
        path: 'attendance',
        loadChildren: () =>
          import('./features/attendance/attendance.routes').then(m => m.ATTENDANCE_ROUTES),
      },
      {
        path: 'announcements',
        loadChildren: () =>
          import('./features/announcements/announcements.routes').then(m => m.ANNOUNCEMENTS_ROUTES),
      },
      {
        path: 'church-groups',
        loadChildren: () =>
          import('./features/church-groups/church-groups.routes')
            .then(m => m.CHURCH_GROUPS_ROUTES),
      },
    ],
```

- [ ] **Step 3: Add the menu item to `sidebar.component.ts`**

In the `navItems` array, add after the `Announcements` entry:

```typescript
    { label: 'Church Groups', icon: 'pi pi-th-large', route: '/church-groups' },
```

The full `navItems` array becomes:

```typescript
  readonly navItems: NavItem[] = [
    { label: 'Home',          icon: 'pi pi-home',         route: '/'             },
    { label: 'Members',       icon: 'pi pi-users',        route: '/members'      },
    { label: 'Ministry',      icon: 'pi pi-sitemap',      route: '/ministry'     },
    { label: 'Attendance',    icon: 'pi pi-check-square', route: '/attendance'   },
    { label: 'Announcements', icon: 'pi pi-megaphone',    route: '/announcements'},
    { label: 'Church Groups', icon: 'pi pi-th-large',     route: '/church-groups'},
    { label: 'Analytics',     icon: 'pi pi-chart-bar',    route: '/analytics'    },
  ];
```

- [ ] **Step 4: Build the frontend to verify no type errors**

```bash
cd hanmaum-dn-web-app
npx ng build --configuration development 2>&1 | tail -20
```

Expected: `Application bundle generation complete.`

- [ ] **Step 5: Commit**

```bash
git add src/app/features/church-groups/church-groups.routes.ts
git add src/app/app.routes.ts
git add src/app/shell/sidebar/sidebar.component.ts
git commit -m "feat(church-groups): wire routing and sidebar menu entry"
```

---

## Task 12: Manual Smoke Test

- [ ] **Step 1: Start the backend** (from `hanmaum-dn-server`):

```bash
./gradlew bootRun
```

- [ ] **Step 2: Start the frontend** (from `hanmaum-dn-web-app`):

```bash
npx ng serve
```

- [ ] **Step 3: Open the app and verify**

1. Navigate to `http://localhost:4200`. Log in as admin.
2. "Church Groups" appears in the sidebar.
3. Click it — the page loads with a loading spinner then shows the matrix grid.
4. Columns are grouped by division (느헤미야/시니어, 다니엘/주니어, etc.).
5. Members appear in their group columns with colored backgrounds matching their discipleship category.
6. Clicking a filter button dims non-matching cells.
7. Clicking again deactivates the filter (cells return to full opacity).
8. Clicking a member cell opens a popover with two checkboxes.
9. Toggling "예비순장" sends a PATCH and turns the cell pink.
10. Toggling "일대일 신청서 제출" sends a PATCH and the value is persisted on page refresh.

- [ ] **Step 4: Commit any final fixes**

```bash
git add -p  # stage only changed files
git commit -m "fix(church-groups): <description of any fix found during smoke test>"
```

---

## Self-Review Notes

- **Spec § 5 category priority** — fully covered in Task 7 (`computeCategory`) and tested in Task 8.
- **Spec § 6.3 grid options** — `suppressMovableColumns`, `suppressCellFocus`, `domLayout: autoHeight` all set in Task 10.
- **Spec § 7 cell renderer** — flag overlay with `isNextGroupLeader` and `oneOnOneSignupFilled` checkboxes, optimistic update, covered in Tasks 9 + 10.
- **Spec § 8 filter buttons** — multi-select toggle, opacity dimming (not row hiding), `clearFilters()` resets all — covered in Task 10.
- **Spec § 9 model updates** — `MemberSummary`, `Member`, `UpdateMemberRequest` all updated in Task 6.
- **Spec § 10 service** — `loadDashboardData`, `patchMemberFlags` covered in Task 7.
- **Spec § 11 out of scope** — no reordering, no export, no mobile layout added.
- **`groupPublicId` on `MemberSummaryDto`** — added in Task 3 (not in original spec but required for `buildMatrix` to work — the matrix groups members by their group's publicId).
