# Ministry Detail: Active Members List

**Date:** 2026-06-10  
**Status:** Approved

## Problem

The ministry detail page (`/ministry/:publicId`) currently shows "등록 목록" — a registration list from the old signup/accept system (`RegistrationDto` via `GET /v1/ministries/{publicId}/registrations`). The new system stores ministry participation as `MinistryAssignment` records on members, where `endDate IS NULL` means the member is currently active in that ministry. The detail page must reflect the new system.

## Goal

Replace the registrations section entirely with a list of currently active members — those with an ongoing `MinistryAssignment` (endDate IS NULL) for the given ministry. Clicking a member navigates to their detail page.

## Architecture

Two layers of change: a new backend sub-resource endpoint, and a frontend replacement of the registrations section.

### Backend: `GET /v1/ministries/{publicId}/members`

**Role:** MEMBER (consistent with existing ministry endpoints).

**Repository** — new query on `MinistryAssignmentRepository`:
```kotlin
@Query("""
  SELECT new com.hanmaum.dn.app.features.ministry.repository.ActiveMemberView(
      a.member.publicId, a.member.fullName, a.startDate, a.note
  )
  FROM MinistryAssignment a
  WHERE a.ministry.publicId = :ministryPublicId
    AND a.endDate IS NULL
    AND a.deletedAt IS NULL
""")
fun findActiveByMinistryPublicId(ministryPublicId: String): List<ActiveMemberView>
```

**Projection:** `ActiveMemberView(memberPublicId: String, fullName: String, startDate: LocalDate, note: String?)`

**Response DTO:** `ActiveMinistryMemberDto(publicId, fullName, startDate, note)` — `publicId` is the member's public ID.

**Service:** New method in `MinistryService` — resolves the ministry by `publicId`, calls the repository query, maps to DTO list.

**Controller:** New method in `MinistryController` delegates to service, returns `ResponseEntity<ApiResponse<List<ActiveMinistryMemberDto>>>`.

No pagination needed (ministry member counts are small).

### Frontend

**`ministry.model.ts`**
```typescript
export interface ActiveMinistryMemberDto {
  publicId: string;   // member public ID
  fullName: string;
  startDate: string;  // 'YYYY-MM-DD'
  note: string | null;
}
```

**`ministry.service.ts`**
```typescript
getActiveMembers(publicId: string): Observable<ActiveMinistryMemberDto[]>
// GET /v1/ministries/{publicId}/members
```

**`ministry-detail.component.ts`**
- Replace `registrations`, `regsLoading`, `periodFilter` with `activeMembers = signal<ActiveMinistryMemberDto[]>([])` and `membersLoading = signal(false)`
- Replace `loadRegistrations()` with `loadActiveMembers()` called on init
- Add `goToMember(publicId: string)` navigating to `/members/{publicId}`
- Remove: `confirmRemoveRegistration()`, `removeRegistration()`, `ConfirmationService`, `ConfirmDialogModule`, `ConfirmDialogModule` import, `FormsModule` (no longer needed for year filter)

**`ministry-detail.component.html`** — replace registrations section with:

| Column | Value |
|--------|-------|
| 회원명 | `fullName` as a text button navigating to `/members/{publicId}` |
| 시작일 | `startDate` formatted as `YYYY년 MM월` |
| 메모 | `note ?? '—'` |

Section heading: `현재 활동 회원` (no year filter bar).  
Empty state: `현재 활동 중인 회원이 없습니다.`

## Removed

- `GET /v1/ministries/{publicId}/registrations` endpoint usage in the frontend (endpoint stays in the backend for now but is no longer called from ministry-detail)
- All registration-related UI: year filter input, `ConfirmDialog`, delete button per row

## Testing

- Backend: unit test for new service method (active members returned, inactive/finished excluded); integration test for `GET /v1/ministries/{publicId}/members`
- Frontend: component test verifying active members render and member-name click navigates correctly
