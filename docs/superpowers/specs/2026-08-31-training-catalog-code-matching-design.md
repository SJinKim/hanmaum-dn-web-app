# Training Catalog — Code Matching Instead of Name Matching

**Date:** 2026-08-31
**Status:** Implemented 2026-08-31 — resolves [#27](https://github.com/SJinKim/hanmaum-dn-web-app/issues/27)
**Relates to:** [2026-05-29-member-form-training-ministry-tabs-design.md](./2026-05-29-member-form-training-ministry-tabs-design.md)

## TL;DR

The server grew its training catalog from 3 to 12 courses and renamed the three existing
ones (`QTBS` → `Quiet Time Basic Seminar`, `1on1` → `One-to-One Discipleship Training`,
`Discipleship` → `Youth Power Discipleship Class`). The dashboard identified courses by
those literal names in four hardcoded places, so every one of them broke at once — and the
member edit form silently deleted a member's whole training history on save.

The dashboard now treats the **catalog as the only source of truth**: courses are
identified by the catalog's stable `code`, labelled from the catalog's `name` / `nameKo`,
and listed in the catalog's `sortOrder`. Nothing about the course set is hardcoded any more,
so the next catalog change needs no frontend release.

## What broke, and why

| Symptom | Cause |
|---|---|
| Saving any member wiped their training history | `rebuildActivities()` resolved trainings via a hardcoded name→enum map, dropped every row, and `persistTrainings()` then PUT an empty list |
| 양육 column showed `members.training.Quiet Time Basic Seminar` | chips translated `members.training.<name>`; `i18n/*.json` only knew the three old names |
| 양육 filter matched nothing | filter hardcoded `['QTBS', '1on1', 'Discipleship']` |
| APPLIED / ENROLLED / DROPPED chips rendered as "completed" | `TrainingStatus` modelled only 2 of the server's 6 values |
| 순 matrix put 일대일수료 members in 제자반수료 | `computeCategory()` substring-matched `"discipleship"`, which is also inside `"One-to-One Discipleship Training"` |

The last row is not listed in the issue; it is the same root cause found while fixing it.

## Design

### Identity: `code`, not `name`

`TrainingCatalogDto` (from `GET /v1/trainings/catalog?activeOnly=false`, ADMIN-only) carries
`publicId`, `code`, `name`, `nameKo`, `category`, `sortOrder`, `hasCohorts`, `isActive`,
`prerequisiteCode`. `code` is stable across renames, so it keys the edit form's rows, the
grid filter's model and the matrix categories.

**One join stays on the name.** `SummaryTrainingDto` and `UserTrainingDto` send only
`name` + `status` — no `code`. So a member's training is joined back onto the catalog by
its English `name`, in exactly one function, `catalogEntryByName()`. When the server adds
`code` to those DTOs, that function is the only place to change.
→ separate issue in `hanmaum-dn-server`.

### Loading: one shared, cached catalog

`TrainingCatalogService` (`core/services`) fetches the catalog once per session
(`shareReplay`), exposes it as a signal, and swallows a failed load into an empty catalog so
it can never tear down a caller's stream. Consumers — grid chips, grid filter, member detail,
member edit, church-groups matrix — read that one signal.

`activeOnly=false` on purpose: a retired course (`KAIROS`) must still resolve for the members
who completed it. Whether a course is *offered* is a separate decision, made by
`trainingOptions()`, which lists active courses plus any code the member already holds.

The service holds data only. Display language comes from `injectAppLang()`
(`core/i18n/language.ts`), so the service does not drag `TranslateService` into every
consumer's injector.

### Statuses: six values, three buckets

`TrainingStatus` now mirrors the server: `APPLIED | ENROLLED | IN_PROGRESS | COMPLETED |
DROPPED | UNKNOWN`. Six checkboxes in a column filter would be unusable, and six chip colors
unreadable, so `trainingStatusGroup()` buckets them:

| Group | Statuses | Chip |
|---|---|---|
| `ACTIVE` | APPLIED, ENROLLED, IN_PROGRESS | orange (`badge-training-progress`) |
| `COMPLETED` | COMPLETED | grey (`badge-training-completed`) |
| `INACTIVE` | DROPPED, UNKNOWN | red (`badge-training-inactive`) |

The colors reuse the palette already in `styles.scss` (orange = `badge-inactive`,
red = `badge-deleted`); there is no `design-specs/DESIGN.md` in this repo to defer to.

The column filter cycles each course off → ACTIVE → COMPLETED → INACTIVE → off, so every
status is reachable. The edit form, which has to round-trip the exact value, uses a full
six-option status select instead of the old "In progress" checkbox — that checkbox could
only express 2 of 6 states and silently rewrote an APPLIED enrolment to COMPLETED on save.

### Two guards against the data loss

`PUT /members/{id}/trainings` replaces the member's entire set, so it now runs only when
both hold:

1. **The training form is dirty.** Saving a member without touching the trainings sends
   nothing at all — an unrelated edit can no longer affect the training history.
2. **The catalog is loaded.** Without it no row resolves to a `publicId` and the request
   would degrade into "replace with nothing".

The edit form additionally `forkJoin`s the catalog with the member, so the form is never
rebuilt against an empty catalog — that race was the original mechanism of the data loss.

## Consequences

- Adding, renaming or retiring a course on the server needs no frontend change.
- `MAX_TRAININGS = 3` is gone: the cap is now "one card per selectable course".
- The `members.training.*` translation keys are gone; `members.trainingStatus.*` replaces them.
- The grid filter model is keyed by `code`, so a persisted pre-change filter model no longer
  matches. Filter models are session state only, so nothing needs migrating.
- `BIBLE_OVERVIEW`'s 구약/신약 variants (`user_training.variant`) are **not** modelled —
  the field is absent from every DTO the dashboard receives.
