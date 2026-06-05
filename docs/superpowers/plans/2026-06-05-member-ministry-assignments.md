# Member Ministry Assignments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the abandoned year-based ministry self-registration flow with an admin-managed start/end-date assignment model, and surface each member's currently-active ministries (multiple) as chips in the members-list grid.

**Architecture:** Repurpose the existing `ministry_registrations` table into an "assignment" (JPA entity `MinistryAssignment`) carrying `start_date` + nullable `end_date` (first-of-month dates; `end_date IS NULL` ⇒ active). Server exposes a replace-set endpoint `PUT /members/{id}/ministries` mirroring the existing trainings endpoint, drops the self-register endpoints, and returns active ministry names on the member summary. Web adds a chips cell to the grid and a ministry card editor to the member form, mirroring the Training feature.

**Tech Stack:** Kotlin + Spring Boot + JPA/Hibernate + Flyway + Postgres (server); Angular standalone components + AG Grid + PrimeNG + Reactive Forms (web).

**Spec:** [docs/superpowers/specs/2026-06-05-member-ministry-assignments-design.md](../specs/2026-06-05-member-ministry-assignments-design.md)

---

## Prerequisites & cross-repo notes

- **HDN ticket:** This plan touches the API contract. Replace `HDN-XXXX` in migration headers and commit messages with the real ticket id before starting. If none exists, create one.
- **Two repos:** Server changes live in `hanmaum-dn-server`; web changes in `hanmaum-dn-web-app`. Per `mvp-focus` this is one coordinated feature. Implement **Phase A (server) fully** before **Phase B (web)** — the web depends on the new contract.
- **OpenAPI sync (`api-contracts` skill):** After Phase A, run `./gradlew generateOpenApiDocs` and sync `build/openapi/openapi.yaml` → `hanmaum-dn-ops/api/openapi.yaml`. The ops repo is **not checked out locally** — if it is unavailable at execution time, record this as a manual follow-up on the HDN ticket rather than skipping it silently.
- **Breaking change:** `MemberSummaryDto.activeMinistry: String?` → `activeMinistries: List<String>` and `MinistryHistoryDto` field changes are breaking, acceptable pre-1.0 because server + web land together.

---

# Phase A — Server (`hanmaum-dn-server`)

## Task S1: Remove the dead self-register / approve flow

**Files:**
- Modify: `src/main/kotlin/com/hanmaum/dn/app/features/ministry/api/v1/MinistryController.kt`
- Modify: `src/main/kotlin/com/hanmaum/dn/app/features/ministry/service/MinistryService.kt`
- Modify: `src/main/kotlin/com/hanmaum/dn/app/features/ministry/api/MinistryMappers.kt`
- Modify: `src/main/kotlin/com/hanmaum/dn/app/features/ministry/api/v1/dto/MinistryDtos.kt`
- Delete: `src/main/kotlin/com/hanmaum/dn/app/features/ministry/domain/RegistrationStatus.kt`
- Modify: `src/main/kotlin/com/hanmaum/dn/app/features/ministry/repository/MinistryRegistrationRepository.kt`
- Modify: `src/test/kotlin/com/hanmaum/dn/app/features/ministry/service/MinistryServiceTest.kt`

- [ ] **Step 1: Delete the registration endpoints from `MinistryController.kt`.** Remove these methods and their now-unused imports (`CreateRegistrationRequest`, `RegistrationDto`, `UpdateRegistrationStatusRequest`, `AuthenticationPrincipal`, `Jwt`, `LocalDate`):
  - `registerSelf` (`POST /{publicId}/registrations`)
  - `getRegistrations` (`GET /{publicId}/registrations`)
  - `getMyRegistration` (`GET /{publicId}/registrations/me`)
  - `approveOrRejectRegistration` (`PATCH /{publicId}/registrations/{regPublicId}`)
  - `withdrawRegistration` (`DELETE /{publicId}/registrations/{regPublicId}`)

  Keep all `Ministry` CRUD methods (`createMinistry`, `getMinistries`, `getMinistry`, `updateMinistry`, `deactivateMinistry`).

- [ ] **Step 2: Delete the registration service methods from `MinistryService.kt`.** Remove `registerSelf`, `getRegistrations`, `getMyRegistration`, `approveOrRejectRegistration`, `withdrawRegistration`, and now-unused imports (`CreateRegistrationRequest`, `RegistrationDto`, `UpdateRegistrationStatusRequest`, `MinistryRegistration`, `RegistrationStatus`, `MinistryRegistrationRepository`, `Instant`, `ChronoUnit`, `toDto`). Remove the `ministryRegistrationRepository` and `memberRepository` constructor params **only if** they become unused (they do — confirm no remaining references). Resulting constructor: `class MinistryService(private val ministryRepository: MinistryRepository)`. Keep the Ministry CRUD methods + `resolveLeader` (note `resolveLeader` uses `memberRepository`, so **keep `memberRepository`** in the constructor).

  Final constructor:
  ```kotlin
  @Service
  class MinistryService(
      private val ministryRepository: MinistryRepository,
      private val memberRepository: MemberRepository,
  ) {
  ```

- [ ] **Step 3: Delete `MinistryRegistration.toDto()` and registration DTOs.** In `MinistryMappers.kt` remove the `fun MinistryRegistration.toDto(): RegistrationDto` function and its imports (`RegistrationDto`, `MinistryRegistration`). In `MinistryDtos.kt` remove `RegistrationDto`, `UpdateRegistrationStatusRequest`, `CreateRegistrationRequest` (and now-unused validation imports if any).

- [ ] **Step 4: Delete `RegistrationStatus.kt`.**

- [ ] **Step 5: Prune registration query methods from `MinistryRegistrationRepository.kt`.** Remove `findByMinistryId`, `existsByMinistryIdAndMemberIdAndRegistrationPeriodAndDeletedAtIsNull`, `findByMinistryIdAndMemberIdAndPeriod`, and `findByPublicIdAndDeletedAtIsNull`. Keep `findByMemberId`, `findApprovedByMemberIds` (rewritten in S4), and `hardDeleteExpired`. (Class rename happens in S3.)

- [ ] **Step 6: Update `MinistryServiceTest.kt`.** Remove the constructor arg in `setUp()` to match the new signature, and delete every test exercising registration (`registerSelf`, approve/reject, withdraw, getMyRegistration, getRegistrations) plus their imports (`CreateRegistrationRequest`, `UpdateRegistrationStatusRequest`, `MinistryRegistration`, `RegistrationStatus`). Keep ministry-CRUD tests.

  New `setUp()`:
  ```kotlin
  @BeforeEach
  fun setUp() {
      service = MinistryService(ministryRepository, memberRepository)
  }
  ```
  (Delete the `registrationRepository` mock field.)

- [ ] **Step 7: Compile + run ministry tests.**

Run: `./gradlew compileKotlin compileTestKotlin test --tests "*MinistryServiceTest"`
Expected: PASS (registration tests gone; CRUD tests green).

- [ ] **Step 8: Commit.**

```bash
git add -A
git commit -m "refactor(ministry): remove dead self-register/approve flow (HDN-XXXX)"
```

---

## Task S2: Repurpose the `MinistryAssignment` entity (rename + start/end dates)

**Files:**
- Rename + modify: `.../ministry/domain/MinistryRegistration.kt` → `.../ministry/domain/MinistryAssignment.kt`
- Rename + modify: `.../ministry/repository/MinistryRegistrationRepository.kt` → `.../ministry/repository/MinistryAssignmentRepository.kt`
- Modify references: `MemberService.kt`, `MemberMappers.kt` (later tasks also touch these)

- [ ] **Step 1: Rename the entity file/class and reshape fields.** Create `MinistryAssignment.kt`, delete `MinistryRegistration.kt`. New entity (drop `registrationPeriod`, `status`; add `startDate`, `endDate`; keep `note`, soft-delete fields; drop the unique constraint annotation since the table-level constraint is removed in S6):

```kotlin
package com.hanmaum.dn.app.features.ministry.domain

import com.hanmaum.dn.app.common.jpa.BaseEntity
import com.hanmaum.dn.app.features.members.domain.Member
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.Instant
import java.time.LocalDate

/**
 * A member's assignment to a [Ministry] for a date range. [startDate] is the
 * first-of-month the assignment began; [endDate] is the first-of-month it ended,
 * or null while the member is currently active in the ministry.
 * Physical table is still `ministry_registrations` (renamed entity only).
 */
@Entity
@Table(name = "ministry_registrations")
class MinistryAssignment(
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ministry_id", nullable = false)
    var ministry: Ministry,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    var member: Member,
    @Column(name = "start_date", nullable = false)
    var startDate: LocalDate,
    @Column(name = "end_date")
    var endDate: LocalDate? = null,
    @Column(columnDefinition = "TEXT", length = 500)
    var note: String? = null,
) : BaseEntity() {
    @Column(name = "delete_entry_at")
    var deleteEntryAt: Instant? = null
}
```

- [ ] **Step 2: Rename the repository file/class** `MinistryRegistrationRepository` → `MinistryAssignmentRepository` (`JpaRepository<MinistryAssignment, Long>`). Update its type params and remaining method return/param types. (Active query rewrite is S4.)

- [ ] **Step 3: Update injection points.** In `MemberService.kt`, update the import + constructor param type/name `MinistryRegistrationRepository ministryRegistrationRepository` → `MinistryAssignmentRepository ministryAssignmentRepository` and rename references (compile will guide). In `MinistryService.kt` there are no remaining references after S1 — confirm.

- [ ] **Step 4: Compile (expect failures in MemberService mapper code that still reads `registrationPeriod`/`status` — fixed in S5).**

Run: `./gradlew compileKotlin`
Expected: errors only in `MemberService.kt` `toHistoryDto` and the active-ministry block (addressed next). If errors appear elsewhere, resolve before proceeding.

- [ ] **Step 5: Commit (may be a non-compiling checkpoint — combine with S5 if your workflow forbids red commits; otherwise):**

```bash
git add -A
git commit -m "refactor(ministry): rename entity to MinistryAssignment + start/end dates (HDN-XXXX) [wip]"
```

> If your execution discipline forbids committing non-compiling code, **do S2 + S5 together** and commit once at the end of S5.

---

## Task S3: Member DTO changes (summary + history + replace request)

**Files:**
- Modify: `.../members/api/v1/dto/MemberDtos.kt`

- [ ] **Step 1: Change `MemberSummaryDto`** — replace the single active ministry with a list:

```kotlin
// was: val activeMinistry: String? = null,
/** Names of the member's currently-active ministry assignments (end_date IS NULL), sorted. */
val activeMinistries: List<String> = emptyList(),
```

- [ ] **Step 2: Change `MinistryHistoryDto`** — replace period/status with dates + note:

```kotlin
/** A single ministry assignment in a member's history. */
data class MinistryHistoryDto(
    val ministryPublicId: String,
    val name: String,
    val startDate: LocalDate,
    val endDate: LocalDate? = null,
    val note: String? = null,
)
```
Ensure `import java.time.LocalDate` is present.

- [ ] **Step 3: Add the replace-set request DTOs** (mirror `ReplaceMemberTrainingsRequest` / `MemberTrainingItem`):

```kotlin
/**
 * PUT /members/{publicId}/ministries — replaces the member's entire assignment set.
 * Each item references a ministry by its publicId, with a start month/year and an
 * optional end (null = ongoing/active).
 */
data class ReplaceMemberMinistriesRequest(
    @field:Valid
    val ministries: List<MemberMinistryItem> = emptyList(),
)

data class MemberMinistryItem(
    @field:NotBlank(message = "ministryPublicId는 필수입니다.")
    val ministryPublicId: String,
    val startDate: LocalDate,
    val endDate: LocalDate? = null,
    @field:Size(max = 500, message = "비고는 최대 500자입니다.")
    val note: String? = null,
)
```
Confirm imports: `jakarta.validation.Valid`, `jakarta.validation.constraints.NotBlank`, `jakarta.validation.constraints.Size`, `java.time.LocalDate`.

- [ ] **Step 4: Compile-check the DTO file’s feature module** (still red in mappers/service — that’s expected, fixed in S5).

Run: `./gradlew compileKotlin || true`
Expected: remaining errors confined to `MemberMappers.kt` / `MemberService.kt`.

- [ ] **Step 5: Commit with S5** (DTOs + their consumers land together).

---

## Task S4: Active-assignments query + `MemberMinistryView`

**Files:**
- Modify: `.../ministry/repository/MemberMinistryView.kt`
- Modify: `.../ministry/repository/MinistryAssignmentRepository.kt`
- Test: `src/test/kotlin/com/hanmaum/dn/app/features/ministry/repository/MinistryAssignmentRepositoryTest.kt` (new, `@DataJpaTest`)

- [ ] **Step 1: Write the failing repository test.** Create `MinistryAssignmentRepositoryTest.kt`:

```kotlin
package com.hanmaum.dn.app.features.ministry.repository

import com.hanmaum.dn.app.features.members.domain.Member
import com.hanmaum.dn.app.features.ministry.domain.Ministry
import com.hanmaum.dn.app.features.ministry.domain.MinistryAssignment
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest
import jakarta.persistence.EntityManager
import java.time.LocalDate

@DataJpaTest
class MinistryAssignmentRepositoryTest(
    @Autowired val repo: MinistryAssignmentRepository,
    @Autowired val em: EntityManager,
) {
    @Test
    fun `findActiveByMemberIds returns only assignments with null endDate`() {
        val member = Member(lastName = "김", firstName = "철수").also { em.persist(it) }
        val choir = Ministry(name = "찬양팀", shortDescription = "x").also { em.persist(it) }
        val media = Ministry(name = "미디어팀", shortDescription = "y").also { em.persist(it) }
        // active (no end)
        em.persist(MinistryAssignment(choir, member, LocalDate.of(2024, 3, 1), null))
        // ended -> excluded
        em.persist(MinistryAssignment(media, member, LocalDate.of(2022, 1, 1), LocalDate.of(2023, 1, 1)))
        em.flush()

        val rows = repo.findActiveByMemberIds(listOf(member.id!!))

        assertEquals(1, rows.size)
        assertEquals("찬양팀", rows.first().ministryName)
        assertEquals(member.id, rows.first().memberId)
    }
}
```

- [ ] **Step 2: Run it — expect failure** (method/view shape don’t exist yet).

Run: `./gradlew test --tests "*MinistryAssignmentRepositoryTest"`
Expected: FAIL (compile error: `findActiveByMemberIds` unresolved / `MemberMinistryView` constructor mismatch).

- [ ] **Step 3: Shrink `MemberMinistryView`** to two fields:

```kotlin
package com.hanmaum.dn.app.features.ministry.repository

/** Flat projection of a member's active ministry assignment, for the members grid. */
data class MemberMinistryView(
    val memberId: Long,
    val ministryName: String,
)
```

- [ ] **Step 4: Replace `findApprovedByMemberIds` with `findActiveByMemberIds`** in `MinistryAssignmentRepository.kt`, and re-point `findByMemberId` ordering to `startDate`:

```kotlin
/** A member's full assignment history (detail view), most recent start first. */
@Query(
    """
    SELECT a FROM MinistryAssignment a
    JOIN FETCH a.ministry
    WHERE a.member.id = :memberId
      AND a.deletedAt IS NULL
    ORDER BY a.startDate DESC, a.createdAt DESC
    """,
)
fun findByMemberId(@Param("memberId") memberId: Long): List<MinistryAssignment>

/**
 * Active assignments (end_date IS NULL) for the given members, projected flat.
 * Drives the "active ministries" chips on the members grid.
 */
@Query(
    """
    SELECT new com.hanmaum.dn.app.features.ministry.repository.MemberMinistryView(
        a.member.id, a.ministry.name
    )
    FROM MinistryAssignment a
    WHERE a.member.id IN :memberIds
      AND a.deletedAt IS NULL
      AND a.endDate IS NULL
    """,
)
fun findActiveByMemberIds(@Param("memberIds") memberIds: Collection<Long>): List<MemberMinistryView>
```
Add a `deleteByMemberId` for the replace flow (mirrors trainings):
```kotlin
@Modifying
@Transactional
@Query("DELETE FROM MinistryAssignment a WHERE a.member.id = :memberId")
fun deleteByMemberId(@Param("memberId") memberId: Long)
```
(Imports: `org.springframework.data.jpa.repository.Modifying`, `org.springframework.transaction.annotation.Transactional` — already present from `hardDeleteExpired`.)

- [ ] **Step 5: Run the test — expect PASS.**

Run: `./gradlew test --tests "*MinistryAssignmentRepositoryTest"`
Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "feat(ministry): active-assignment query by null end date (HDN-XXXX)"
```

---

## Task S5: Wire `MemberService` + `MemberMappers` to the new model

**Files:**
- Modify: `.../members/api/MemberMappers.kt`
- Modify: `.../members/service/MemberService.kt`

- [ ] **Step 1: Update `toSummaryDto` in `MemberMappers.kt`:**

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
        groupName = this.group?.name,
        updatedAt = this.updatedAt,
        latestTraining = latestTraining,
        trainings = trainings,
        activeMinistries = activeMinistries,
    )
```

- [ ] **Step 2: Update the active-ministry enrichment in `MemberService.getMembers`.** Replace the `activeMinistryByMember` block + the `.map { it.toSummaryDto(...) }` call:

```kotlin
val activeMinistriesByMember: Map<Long, List<String>> =
    if (memberIds.isEmpty()) {
        emptyMap()
    } else {
        ministryAssignmentRepository
            .findActiveByMemberIds(memberIds)
            .groupBy { it.memberId }
            .mapValues { (_, rows) -> rows.map { it.ministryName }.sorted() }
    }

return members.map {
    it.toSummaryDto(
        latestTraining = it.id?.let(latestTrainingByMember::get),
        trainings = it.id?.let(trainingsByMember::get).orEmpty(),
        activeMinistries = it.id?.let(activeMinistriesByMember::get).orEmpty(),
    )
}
```
Update the comment on line ~84 to: `//  - active ministries = ministry names where end_date IS NULL`.

- [ ] **Step 3: Update `toHistoryDto` in `MemberService.kt`:**

```kotlin
private fun MinistryAssignment.toHistoryDto(): MinistryHistoryDto =
    MinistryHistoryDto(
        ministryPublicId = this.ministry.publicId.toString(),
        name = this.ministry.name,
        startDate = this.startDate,
        endDate = this.endDate,
        note = this.note,
    )
```
Update imports: `MinistryAssignment`, `MinistryAssignmentRepository`.

- [ ] **Step 4: Compile the whole module.**

Run: `./gradlew compileKotlin compileTestKotlin`
Expected: PASS (all references reconciled).

- [ ] **Step 5: Commit (folds in S2 + S3 if you deferred their commits).**

```bash
git add -A
git commit -m "feat(members): surface active ministries + assignment history dto (HDN-XXXX)"
```

---

## Task S6: Flyway migration (`db-migrations` skill)

**Files:**
- Create: `src/main/resources/db/migration/V<YYYYMMDDHHMM>__ministry_assignment_dates.sql`

- [ ] **Step 1: Write the migration.** Use a current UTC minute timestamp for the version (see existing files for format). Backfill `start_date` **before** setting NOT NULL, then drop the old columns + unique constraint:

```sql
-- HDN-XXXX: repurpose ministry_registrations into date-based assignments
-- Small table (pre-MVP); runtime negligible.

ALTER TABLE ministry_registrations ADD COLUMN start_date DATE;
ALTER TABLE ministry_registrations ADD COLUMN end_date   DATE;

-- Legacy rows: treat the registration year as a Jan-1 start, currently ongoing.
UPDATE ministry_registrations
SET start_date = (registration_period || '-01-01')::date
WHERE start_date IS NULL AND registration_period IS NOT NULL;

-- Any row without a usable period falls back to today (defensive; expected 0 rows).
UPDATE ministry_registrations
SET start_date = CURRENT_DATE
WHERE start_date IS NULL;

ALTER TABLE ministry_registrations ALTER COLUMN start_date SET NOT NULL;

ALTER TABLE ministry_registrations DROP CONSTRAINT IF EXISTS uq_ministry_member_period;
ALTER TABLE ministry_registrations DROP COLUMN registration_period;
ALTER TABLE ministry_registrations DROP COLUMN registration_status;
```

- [ ] **Step 2: Verify against a fresh Postgres** (per db-migrations skill):

Run: `docker compose down -v && docker compose up -d postgres && ./gradlew flywayMigrate`
Expected: migration applies cleanly; `\d ministry_registrations` shows `start_date NOT NULL`, `end_date` nullable, no `registration_period`/`registration_status`.

- [ ] **Step 3: Run the full server test suite.**

Run: `./gradlew test`
Expected: PASS.

- [ ] **Step 4: Commit.**

```bash
git add -A
git commit -m "db(ministry): add start/end dates, drop year-based columns (HDN-XXXX)"
```

---

## Task S7: `PUT /members/{publicId}/ministries` endpoint + replace service

**Files:**
- Modify: `.../members/api/v1/MemberController.kt`
- Modify: `.../members/service/MemberService.kt`
- Test: `src/test/kotlin/com/hanmaum/dn/app/features/members/service/MemberServiceMinistryTest.kt` (new, Mockito unit test)

- [ ] **Step 1: Write the failing service test.** Mirror the Mockito style of `MinistryServiceTest` (mock repos, reflectively set ids). Create `MemberServiceMinistryTest.kt` covering: replace deletes existing then inserts, resolves ministry by publicId, returns history dto with dates.

```kotlin
package com.hanmaum.dn.app.features.members.service

import com.hanmaum.dn.app.features.members.api.v1.dto.MemberMinistryItem
import com.hanmaum.dn.app.features.members.api.v1.dto.ReplaceMemberMinistriesRequest
import com.hanmaum.dn.app.features.members.domain.Member
import com.hanmaum.dn.app.features.members.repository.MemberRepository
import com.hanmaum.dn.app.features.ministry.domain.Ministry
import com.hanmaum.dn.app.features.ministry.domain.MinistryAssignment
import com.hanmaum.dn.app.features.ministry.repository.MinistryAssignmentRepository
import com.hanmaum.dn.app.features.ministry.repository.MinistryRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.Mockito.verify
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import java.time.LocalDate
import java.util.Optional
import java.util.UUID

@ExtendWith(MockitoExtension::class)
class MemberServiceMinistryTest {
    @Mock lateinit var memberRepository: MemberRepository
    @Mock lateinit var ministryRepository: MinistryRepository
    @Mock lateinit var ministryAssignmentRepository: MinistryAssignmentRepository
    // NOTE: MemberService has more deps (training repos, keycloak). For this unit test,
    // construct it with mocks for all constructor params — copy the full param list from
    // MemberService and add @Mock fields for each (userTrainingRepository, trainingRepository,
    // churchGroupRepository, keycloak, realm="test").

    @Test
    fun `replaceMemberMinistries deletes existing then inserts from request`() {
        val member = makeMember(publicId = UUID.randomUUID())
        val ministry = makeMinistry(publicId = UUID.randomUUID(), name = "찬양팀")
        whenever(memberRepository.findByPublicIdAndDeletedAtIsNull(member.publicId)).thenReturn(Optional.of(member))
        whenever(ministryRepository.findByPublicIdAndDeletedAtIsNull(ministry.publicId)).thenReturn(Optional.of(ministry))
        whenever(ministryAssignmentRepository.findByMemberId(any())).thenReturn(emptyList())

        val req = ReplaceMemberMinistriesRequest(
            ministries = listOf(
                MemberMinistryItem(ministry.publicId.toString(), LocalDate.of(2024, 3, 1), null, "악기"),
            ),
        )
        val result = service.replaceMemberMinistries(member.publicId, req)

        verify(ministryAssignmentRepository).deleteByMemberId(member.id!!)
        verify(ministryAssignmentRepository).saveAll(any<List<MinistryAssignment>>())
        // history reflects what we re-read; assert no exception + publicId echoed
        assertEquals(member.publicId.toString(), result.publicId)
    }
    // makeMember / makeMinistry / setId helpers: copy the reflective-id pattern from MinistryServiceTest.
}
```
> The exact mock wiring depends on `MemberService`'s full constructor — replicate every dependency as a `@Mock` and build `service` in `@BeforeEach`. Keep the assertions above.

- [ ] **Step 2: Run — expect failure** (`replaceMemberMinistries` undefined).

Run: `./gradlew test --tests "*MemberServiceMinistryTest"`
Expected: FAIL (unresolved reference).

- [ ] **Step 3: Add `replaceMemberMinistries` to `MemberService.kt`** (inject `ministryRepository: MinistryRepository` into the constructor — add the import + param), mirroring `replaceMemberTrainings`:

```kotlin
/**
 * Replaces a member's entire ministry assignment set (PUT semantics). Existing
 * rows are deleted and re-created from the request. Returns refreshed member detail.
 */
@Transactional
fun replaceMemberMinistries(
    publicId: UUID,
    request: ReplaceMemberMinistriesRequest,
): MemberDto {
    val member =
        memberRepository
            .findByPublicIdAndDeletedAtIsNull(publicId)
            .orElseThrow { EntityNotFoundException("Member not found: $publicId") }
    val memberId = member.id!!

    ministryAssignmentRepository.deleteByMemberId(memberId)
    ministryAssignmentRepository.flush()

    val rows =
        request.ministries.map { item ->
            val ministry =
                ministryRepository
                    .findByPublicIdAndDeletedAtIsNull(UUID.fromString(item.ministryPublicId))
                    .orElseThrow { EntityNotFoundException("Ministry not found: ${item.ministryPublicId}") }
            MinistryAssignment(
                ministry = ministry,
                member = member,
                startDate = item.startDate,
                endDate = item.endDate,
                note = item.note,
            )
        }
    ministryAssignmentRepository.saveAll(rows)

    val trainings = userTrainingRepository.findByMemberId(memberId).map { it.toDto() }
    val ministries = ministryAssignmentRepository.findByMemberId(memberId).map { it.toHistoryDto() }
    return member.toDto(trainings, ministries)
}
```
Imports to add: `ReplaceMemberMinistriesRequest`, `MinistryRepository`, `MinistryAssignment`. (`flush()` exists on `JpaRepository`.)

- [ ] **Step 4: Add the controller endpoint** in `MemberController.kt` (after `replaceMemberTrainings`):

```kotlin
/**
 * PUT /api/v1/members/{publicId}/ministries
 * Role: ADMIN — replaces the member's entire ministry assignment set. Returns refreshed detail.
 */
@PutMapping("/{publicId}/ministries")
@PreAuthorize("hasRole('ADMIN')")
fun replaceMemberMinistries(
    @PathVariable publicId: UUID,
    @Valid @RequestBody request: ReplaceMemberMinistriesRequest,
): ResponseEntity<ApiResponse<MemberDto>> {
    val updated = memberService.replaceMemberMinistries(publicId, request)
    return ResponseEntity.ok(ApiResponse.success(data = updated))
}
```
Add import `ReplaceMemberMinistriesRequest`.

- [ ] **Step 5: Run the test — expect PASS.**

Run: `./gradlew test --tests "*MemberServiceMinistryTest"`
Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "feat(members): PUT /members/{id}/ministries replace-set endpoint (HDN-XXXX)"
```

---

## Task S8: Regenerate + sync OpenAPI; full server verification

- [ ] **Step 1: Full test suite.**

Run: `./gradlew test`
Expected: PASS.

- [ ] **Step 2: Regenerate the spec.**

Run: `./gradlew generateOpenApiDocs`
Expected: `build/openapi/openapi.yaml` updated (no `/registrations` paths; new `/members/{publicId}/ministries`; `activeMinistries` array on the summary schema).

- [ ] **Step 3: Sync to ops + notify (api-contracts skill).** Copy into `hanmaum-dn-ops/api/openapi.yaml`, commit there with `HDN-XXXX`. If the ops repo is not checked out, record a manual follow-up on the ticket.

- [ ] **Step 4: Commit any generated artifacts tracked in this repo (if applicable).**

```bash
git add -A
git commit -m "docs(api): regenerate openapi for ministry assignments (HDN-XXXX)"
```

---

# Phase B — Web (`hanmaum-dn-web-app`)

## Task W1: Update models (`member.model.ts`, `member-activity.model.ts`)

**Files:**
- Modify: `src/app/core/models/member.model.ts`
- Modify: `src/app/core/models/member-activity.model.ts`

- [ ] **Step 1: Add `activeMinistries` to `MemberSummary`** in `member.model.ts`:

```typescript
  /** Names of currently-active ministries — rendered as chips in the grid. */
  activeMinistries?: string[];
```

- [ ] **Step 2: Reshape `MinistryHistory`** in `member-activity.model.ts`:

```typescript
/**
 * A member's ministry assignment as returned by `GET /members/{id}` → `ministries`.
 * `endDate` null ⇒ currently active. Dates are first-of-month ISO strings 'YYYY-MM-DD'.
 */
export interface MinistryHistory {
  ministryPublicId: string;
  name: string;
  startDate: string;        // ISO 'YYYY-MM-DD'
  endDate: string | null;   // null = ongoing
  note: string | null;
}
```

- [ ] **Step 3: Add the ministry catalog + form/item types** in `member-activity.model.ts` (mirror training):

```typescript
// --- MINISTRY (admin-managed assignments) ---

/** Ministry option from `GET /ministries` (summary list). */
export interface MinistryCatalogEntry {
  publicId: string;
  name: string;
}

/** A single item in the `PUT /members/{id}/ministries` request body. */
export interface MemberMinistryItem {
  ministryPublicId: string;
  startDate: string;        // 'YYYY-MM-DD' first-of-month
  endDate: string | null;   // null = ongoing
  note: string | null;
}

/** The ministry editor's per-card value. */
export interface MinistryFormValue {
  ministryPublicId: string | null;
  startMonth: number | null;
  startYear: number | null;
  endMonth: number | null;
  endYear: number | null;
  ongoing: boolean;
  note: string | null;
}

/** first-of-month ISO → {month, year}; reuses the training helper. */
export function firstOfMonthToMonthYear(iso: string | null): { month: number | null; year: number | null } {
  return monthYearFromCompletedAt(iso);
}

/** {month, year} → first-of-month ISO 'YYYY-MM-01', or null. Reuses the training helper. */
export function monthYearToFirstOfMonth(month: number | null, year: number | null): string | null {
  return completedAtFromMonthYear(month, year);
}
```
(`monthYearFromCompletedAt` / `completedAtFromMonthYear` already exist in this file.)

- [ ] **Step 4: Typecheck.**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: errors only where consumers still read removed fields (`registrationPeriod`/`status`) — fixed in W4/W5.

- [ ] **Step 5: Commit.**

```bash
git add -A
git commit -m "feat(members): ministry assignment models (start/end/note)"
```

---

## Task W2: Ministry chips cell + grid column

**Files:**
- Create: `src/app/features/members/members-list/cells/ministry-chips-cell.component.ts`
- Modify: `src/app/features/members/members-list/members-list.component.ts`
- Modify: `src/styles.scss`
- Test: `src/app/features/members/members-list/cells/ministry-chips-cell.component.spec.ts`

- [ ] **Step 1: Write the failing spec.**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ICellRendererParams } from 'ag-grid-community';
import { MinistryChipsCellComponent } from './ministry-chips-cell.component';

describe('MinistryChipsCellComponent', () => {
  let fixture: ComponentFixture<MinistryChipsCellComponent>;
  let component: MinistryChipsCellComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MinistryChipsCellComponent] });
    fixture = TestBed.createComponent(MinistryChipsCellComponent);
    component = fixture.componentInstance;
  });

  it('shows a dash when empty', () => {
    component.agInit({ value: [] } as unknown as ICellRendererParams);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('—');
  });

  it('renders one chip per active ministry', () => {
    component.agInit({ value: ['찬양팀', '미디어팀'] } as unknown as ICellRendererParams);
    fixture.detectChanges();
    const chips = fixture.nativeElement.querySelectorAll('.status-badge');
    expect(chips.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run — expect failure** (component missing).

Run: `npx ng test --watch=false --include='**/ministry-chips-cell.component.spec.ts'`
Expected: FAIL (cannot find module).

- [ ] **Step 3: Implement the cell** (mirror `TrainingChipsCellComponent`):

```typescript
import { Component } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

/** Renders a member's currently-active ministry names as chips; '—' when none. */
@Component({
  selector: 'app-ministry-chips-cell',
  standalone: true,
  template: `
    @if (names.length === 0) {
      <span class="text-tertiary">—</span>
    } @else {
      <div class="chips">
        @for (n of names; track $index) {
          <span class="status-badge badge-ministry-active">{{ n }}</span>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: flex; align-items: center; height: 100%; }
    .chips { display: flex; flex-wrap: wrap; gap: 4px; }
  `],
})
export class MinistryChipsCellComponent implements ICellRendererAngularComp {
  names: string[] = [];
  agInit(params: ICellRendererParams): void { this.update(params); }
  refresh(params: ICellRendererParams): boolean { this.update(params); return true; }
  private update(params: ICellRendererParams): void {
    this.names = (params.value as string[] | undefined) ?? [];
  }
}
```

- [ ] **Step 4: Add the chip color** in `src/styles.scss` after `badge-training-progress` (line ~62):

```scss
  // Ministry chips: blue = currently active.
  &.badge-ministry-active { background: #dbeafe; color: #1d4ed8; }
```

- [ ] **Step 5: Wire the grid column** in `members-list.component.ts` — replace the stubbed Ministry column (lines ~130-139) and add the import:

```typescript
    {
      headerName: 'Ministry',
      colId: 'ministry',
      width: 200,
      valueGetter: p => p.data?.activeMinistries ?? [],
      cellRenderer: MinistryChipsCellComponent,
      sortable: false,
      filter: false,
    },
```
Add: `import { MinistryChipsCellComponent } from './cells/ministry-chips-cell.component';`

- [ ] **Step 6: Run the spec — expect PASS.**

Run: `npx ng test --watch=false --include='**/ministry-chips-cell.component.spec.ts'`
Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add -A
git commit -m "feat(members): active-ministry chips column in members grid"
```

---

## Task W3: Ministry service method

**Files:**
- Modify: `src/app/features/members/member.service.ts`

- [ ] **Step 1: Add the catalog + replace methods** (mirror trainings):

```typescript
  /** Ministry options for the member edit form (active ministries only). */
  getMinistryCatalog(): Observable<MinistryCatalogEntry[]> {
    return this.api.get<MinistryCatalogEntry[]>('/v1/ministries', { active: true });
  }

  /** Replaces the member's entire ministry assignment set; returns refreshed detail. */
  replaceMemberMinistries(publicId: string, ministries: MemberMinistryItem[]): Observable<Member> {
    return this.api.put<Member>(`/v1/members/${publicId}/ministries`, { ministries });
  }
```
Add imports from `member-activity.model`: `MinistryCatalogEntry`, `MemberMinistryItem`. Confirm `ApiService.get` accepts a query-params object (it does — see `getMembers`).

> **Note:** `GET /ministries` returns `MinistrySummaryDto` (`publicId`, `name`, …). `MinistryCatalogEntry` is a structural subset, so the cast is safe.

- [ ] **Step 2: Typecheck.**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no new errors from this file.

- [ ] **Step 3: Commit.**

```bash
git add -A
git commit -m "feat(members): ministry catalog + replace-set service methods"
```

---

## Task W4: Member detail — render assignments with dates + note

**Files:**
- Modify: `src/app/features/members/member-detail/member-detail.component.ts`
- Modify: `src/app/features/members/member-detail/member-detail.component.html`

- [ ] **Step 1: Add a date formatter** in `member-detail.component.ts` (reuse `mmYy` + `monthYearFromCompletedAt`):

```typescript
  /** "MM/YY – MM/YY", or "MM/YY – 현재" when ongoing. */
  ministryRange(m: MinistryHistory): string {
    const s = monthYearFromCompletedAt(m.startDate);
    const start = s.month && s.year ? this.mmYy(s.month, s.year) : '—';
    if (!m.endDate) return `${start} – 현재`;
    const e = monthYearFromCompletedAt(m.endDate);
    const end = e.month && e.year ? this.mmYy(e.month, e.year) : '—';
    return `${start} – ${end}`;
  }
```
(`mmYy` already exists as a private method; keep it. `MinistryHistory` is already imported.)

- [ ] **Step 2: Update the ministry block** in `member-detail.component.html` (lines ~160-164):

```html
          @for (m of ministries(); track $index) {
            <div class="flex flex-col gap-1 px-4 py-3 rounded-lg border border-gray-100 bg-gray-50/50">
              <div class="flex items-center justify-between">
                <span class="text-[13px] font-semibold text-gray-800">{{ m.name }}</span>
                <span class="text-[13px] text-secondary tabular-nums">{{ ministryRange(m) }}</span>
              </div>
              @if (m.note) {
                <span class="text-[12px] text-tertiary">{{ m.note }}</span>
              }
            </div>
          }
```

- [ ] **Step 3: Typecheck + build.**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: PASS (no remaining `registrationPeriod` references).

- [ ] **Step 4: Commit.**

```bash
git add -A
git commit -m "feat(members): show ministry assignment dates + note on detail view"
```

---

## Task W5: Member edit — ministry card editor

**Files:**
- Modify: `src/app/features/members/member-edit/member-edit.component.ts`
- Modify: `src/app/features/members/member-edit/member-edit.component.html`
- Test: `src/app/features/members/member-edit/member-edit.component.spec.ts` (add cases; create if absent)

- [ ] **Step 1: Write the failing spec** for the ministry editor’s ongoing-toggle + item mapping. Create/extend `member-edit.component.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MemberEditComponent } from './member-edit.component';

describe('MemberEditComponent ministry editor', () => {
  function make(): MemberEditComponent {
    TestBed.configureTestingModule({
      imports: [MemberEditComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    return TestBed.createComponent(MemberEditComponent).componentInstance;
  }

  it('addMinistry pushes an ongoing card and removeMinistry pops it', () => {
    const c = make();
    c.addMinistry();
    expect(c.ministries.length).toBe(1);
    expect(c.ministries.at(0).get('ongoing')!.value).toBe(true);
    c.removeMinistry(0);
    expect(c.ministries.length).toBe(0);
  });

  it('toggling ongoing off enables end month/year', () => {
    const c = make();
    c.addMinistry();
    c.ministries.at(0).get('ongoing')!.setValue(false);
    c.onMinistryOngoingChange(0);
    expect(c.ministries.at(0).get('endMonth')!.disabled).toBe(false);
  });

  it('collectMinistryItems maps an ongoing card to endDate null', () => {
    const c = make();
    c.addMinistry();
    c.ministries.at(0).patchValue({
      ministryPublicId: 'abc', startMonth: 3, startYear: 2024, ongoing: true,
    });
    const items = (c as unknown as { collectMinistryItems(): unknown[] }).collectMinistryItems();
    expect(items).toEqual([{ ministryPublicId: 'abc', startDate: '2024-03-01', endDate: null, note: null }]);
  });
});
```

- [ ] **Step 2: Run — expect failure** (members editor methods missing).

Run: `npx ng test --watch=false --include='**/member-edit.component.spec.ts'`
Expected: FAIL.

- [ ] **Step 3: Add ministry state to `member-edit.component.ts`.** Add a `ministries` FormArray, catalog signal, options, and methods (mirror the training block). Key additions:

```typescript
// imports
import {
  MinistryCatalogEntry, MemberMinistryItem, MinistryFormValue,
  monthYearToFirstOfMonth, firstOfMonthToMonthYear, MinistryHistory,
} from '../../../core/models/member-activity.model';

// fields
private readonly ministryCatalog = signal<MinistryCatalogEntry[]>([]);
readonly ministryOptions = computed(() =>
  this.ministryCatalog().map(m => ({ value: m.publicId, label: m.name })));

// in the form group, add:
//   ministries: this.fb.array<FormGroup>([]),
get ministries(): FormArray<FormGroup> { return this.form.get('ministries') as FormArray<FormGroup>; }

// ngOnInit: load the catalog alongside the training catalog
this.memberService.getMinistryCatalog()
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe({ next: c => this.ministryCatalog.set(c) });

// card factory
private newMinistryGroup(value?: MinistryFormValue): FormGroup {
  const ongoing = value?.ongoing ?? true;
  const group = this.fb.group({
    ministryPublicId: [value?.ministryPublicId ?? null as string | null, Validators.required],
    startMonth: [value?.startMonth ?? null as number | null, Validators.required],
    startYear:  [value?.startYear ?? null as number | null, Validators.required],
    endMonth:   [value?.endMonth ?? null as number | null],
    endYear:    [value?.endYear ?? null as number | null],
    ongoing:    [ongoing],
    note:       [value?.note ?? null as string | null],
  });
  if (ongoing) { group.get('endMonth')!.disable(); group.get('endYear')!.disable(); }
  return group;
}

addMinistry(): void { this.ministries.push(this.newMinistryGroup()); }
removeMinistry(index: number): void { this.ministries.removeAt(index); }

onMinistryOngoingChange(index: number): void {
  const g = this.ministries.at(index);
  const ongoing = g.get('ongoing')!.value;
  const em = g.get('endMonth')!, ey = g.get('endYear')!;
  if (ongoing) { em.reset(null); ey.reset(null); em.disable(); ey.disable(); }
  else { em.enable(); ey.enable(); }
}

private collectMinistryItems(): MemberMinistryItem[] {
  return this.ministries.controls
    .map(c => c.getRawValue())
    .filter(v => v.ministryPublicId && v.startMonth && v.startYear)
    .map(v => ({
      ministryPublicId: v.ministryPublicId as string,
      startDate: monthYearToFirstOfMonth(v.startMonth, v.startYear)!,
      endDate: v.ongoing ? null : monthYearToFirstOfMonth(v.endMonth, v.endYear),
      note: (v.note as string | null)?.trim() || null,
    }));
}

private rebuildMinistries(ministries: MinistryHistory[] = []): void {
  this.ministries.clear();
  ministries.forEach(m => {
    const s = firstOfMonthToMonthYear(m.startDate);
    const e = firstOfMonthToMonthYear(m.endDate);
    this.ministries.push(this.newMinistryGroup({
      ministryPublicId: m.ministryPublicId,
      startMonth: s.month, startYear: s.year,
      endMonth: e.month, endYear: e.year,
      ongoing: m.endDate === null,
      note: m.note,
    }));
  });
}
```
Add `computed` to the `@angular/core` import. In `patchForm`, call `this.rebuildMinistries(member.ministries ?? [])` after `rebuildActivities`.

- [ ] **Step 4: Wire save** — persist ministries after the member + trainings save. In `save()`, collect items and chain a second `switchMap`, guarded like trainings:

```typescript
const ministryItems = this.collectMinistryItems();
// ...
member$
  .pipe(
    switchMap(member => this.persistTrainings(member, trainingItems)),
    switchMap(member => this.persistMinistries(member, ministryItems)),
    takeUntilDestroyed(this.destroyRef),
  )
  // ...

private persistMinistries(member: Member, items: MemberMinistryItem[]): Observable<Member> {
  if (this.ministryCatalog().length === 0) return of(member);
  return this.memberService.replaceMemberMinistries(member.publicId, items);
}
```

- [ ] **Step 5: Add the editor UI** in `member-edit.component.html` — a new box after the Training box (before `<!-- Actions -->`), mirroring the training markup. Uses `ministryOptions()`, start/end month-year selects, the ongoing checkbox, and a note input:

```html
      <!-- Ministry box -->
      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div class="flex items-center justify-between pb-1 border-b border-gray-50 mb-4">
          <div class="text-[9px] font-bold text-tertiary uppercase tracking-widest">Ministries</div>
          <span class="text-[11px] text-tertiary">{{ ministries.length }}</span>
        </div>

        @if (ministries.length === 0) {
          <div class="text-[13px] text-tertiary py-6 text-center border border-dashed border-gray-200 rounded-lg mb-4">
            No ministries added yet.
          </div>
        }

        <div class="flex flex-col gap-3 mb-4" formArrayName="ministries">
          @for (group of ministries.controls; track $index; let i = $index) {
            <div [formGroupName]="i" class="date-select-compact flex flex-col gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50/50">
              <div class="flex items-end gap-2">
                <div class="flex flex-col gap-1 flex-1">
                  <label class="text-[10px] font-semibold text-secondary uppercase tracking-widest">Ministry</label>
                  <p-select formControlName="ministryPublicId" [options]="ministryOptions()" optionLabel="label" optionValue="value" placeholder="Select" class="w-full" />
                </div>
                <button type="button" (click)="removeMinistry(i)" aria-label="Remove ministry"
                  class="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 text-tertiary hover:text-red-500 hover:border-red-300 transition-colors">
                  <i class="pi pi-trash text-[12px]"></i>
                </button>
              </div>

              <div class="flex items-end gap-3 flex-wrap">
                <div class="flex flex-col gap-1">
                  <label class="text-[10px] font-semibold text-secondary uppercase tracking-widest">From</label>
                  <div class="flex items-center gap-1">
                    <p-select formControlName="startMonth" [options]="monthOptions" optionLabel="label" optionValue="value" placeholder="MM" class="w-11" />
                    <p-select formControlName="startYear" [options]="yearOptions" optionLabel="label" optionValue="value" placeholder="YY" class="w-11" />
                  </div>
                </div>

                @if (!group.get('ongoing')!.value) {
                  <div class="flex flex-col gap-1">
                    <label class="text-[10px] font-semibold text-secondary uppercase tracking-widest">To</label>
                    <div class="flex items-center gap-1">
                      <p-select formControlName="endMonth" [options]="monthOptions" optionLabel="label" optionValue="value" placeholder="MM" class="w-11" />
                      <p-select formControlName="endYear" [options]="yearOptions" optionLabel="label" optionValue="value" placeholder="YY" class="w-11" />
                    </div>
                  </div>
                }

                <label class="flex items-center gap-1 pb-1.5 ml-auto cursor-pointer">
                  <p-checkbox formControlName="ongoing" [binary]="true" (onChange)="onMinistryOngoingChange(i)" />
                  <span class="text-[11px] font-semibold text-secondary">Ongoing</span>
                </label>
              </div>

              <div class="flex flex-col gap-1">
                <label class="text-[10px] font-semibold text-secondary uppercase tracking-widest">Note</label>
                <input pInputText formControlName="note" maxlength="500" placeholder="Optional" class="w-full text-[13px]" />
              </div>
            </div>
          }
        </div>

        <button type="button" (click)="addMinistry()"
          class="flex items-center gap-2 h-9 px-4 rounded-lg border border-dashed border-gray-300 text-secondary text-[12px] font-semibold hover:border-primary hover:text-primary transition-colors tracking-tight mb-2">
          <i class="pi pi-plus text-[11px]"></i>
          Add Ministry
        </button>
      </div><!-- /Ministry box -->
```
(The grid wrapper is `lg:grid-cols-3`; this becomes the 3rd column. `pInputText`, `p-select`, `p-checkbox` are already imported in the component.)

- [ ] **Step 6: Run the spec — expect PASS.**

Run: `npx ng test --watch=false --include='**/member-edit.component.spec.ts'`
Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add -A
git commit -m "feat(members): ministry assignment editor in member form"
```

---

## Task W6: Full web verification

- [ ] **Step 1: Lint + typecheck + unit tests.**

Run: `npx ng lint && npx tsc --noEmit -p tsconfig.app.json && npx ng test --watch=false`
Expected: PASS.

- [ ] **Step 2: Production build.**

Run: `npx ng build`
Expected: build succeeds.

- [ ] **Step 3: Manual smoke (per `verify` skill).** With the server running: open the members grid (active ministries show as chips), open a member, edit → add a ministry with From + Ongoing + note → save → confirm it appears active on the grid and on the detail view; set a To date → save → confirm it drops off the grid chips but remains in detail history.

- [ ] **Step 4: Commit any fixups, then finish the branch** (see `finishing-a-development-branch`).

---

## Self-Review (completed during planning)

**Spec coverage:**
- Grid active-ministry chips → W2 (+ S3/S4/S5 backend). ✓
- Start/end month-year model → S2 entity, S6 migration, W1 models, W5 editor. ✓
- Active = `end_date IS NULL` → S4 query, W2 chips, W4/W5 ongoing. ✓
- Remove self-register flow → S1. ✓
- `PUT /members/{id}/ministries` replace-set → S7. ✓
- `note` kept + UI-integrated → S2/S3 (DTO), W4 (detail), W5 (editor). ✓
- Table stays `ministry_registrations`, entity renamed → S2/S6. ✓
- api-contracts sync → S8. ✓

**Type consistency:** `MinistryAssignment`, `MinistryAssignmentRepository`, `findActiveByMemberIds`, `MemberMinistryView(memberId, ministryName)`, `activeMinistries`, `ReplaceMemberMinistriesRequest`/`MemberMinistryItem` (server) and `MinistryHistory`/`MemberMinistryItem`/`MinistryCatalogEntry`/`MinistryFormValue` (web) are used consistently across tasks.

**Placeholder scan:** `HDN-XXXX` is an intentional, called-out external input (see Prerequisites), not a lazy placeholder. The migration version timestamp is intentionally left to execution time per the db-migrations naming rule. No other placeholders.
