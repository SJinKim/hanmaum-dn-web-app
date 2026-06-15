# 예비순장 Highlighter Feature Design

**Date:** 2026-06-11
**Branch:** feat/churchgroupFE

## Summary

Extend the `예비순장` legend filter button so it doubles as a highlight/edit mode. When active, it dims non-candidates as before AND lets the admin click `제자반수료` cells to mark them as `isNextGroupLeader = true` (or click existing `예비순장` cells to unmark them). Changes persist immediately to the backend via the existing `patchMemberFlags` API.

---

## 1. Legend Button Behavior

The `예비순장` legend button remains a single toggle. When active it now does two things simultaneously:

1. **Filter** — existing behavior: all cells whose category is not `NEXT_LEADER` dim to `opacity-20`.
2. **Highlight mode** — new: `DISCIPLESHIP_COMPLETED` cells are exempted from dimming and instead render with a pulsing dashed ring to signal they are clickable promotion candidates.

No new button or mode switch is introduced. The change is confined to the `isDimmed` logic:

> When `예비순장` is active AND a cell's category is `DISCIPLESHIP_COMPLETED`, `isDimmed` returns `false` instead of `true`.

---

## 2. Cell Rendering in Highlight Mode

When `예비순장` is active, cells render in one of three states:

| Category | Appearance |
|---|---|
| `NEXT_LEADER` | Full opacity, pink — clickable (to unmark) |
| `DISCIPLESHIP_COMPLETED` | Full opacity, purple + pulsing dashed ring — clickable (to promote) |
| All others | `opacity-20`, not interactive |

The pulsing ring is a CSS `@keyframes` animation applied via a `.cg-candidate` class. Cursor changes to `pointer` on interactive cells. The animation is only active while `예비순장` mode is on.

`NEXT_LEADER` cells are also clickable to **unmark** (`isNextGroupLeader = false`), allowing the admin to correct mistakes without leaving the mode.

---

## 3. Click Interaction & Optimistic Update

On click of an interactive cell:

1. Find the member in the `members` signal by `publicId`.
2. Flip `isNextGroupLeader` on that member and write back `members.set([...members()])` to trigger reactivity.
3. The `matrix` computed signal recomputes — cell color changes instantly (purple→pink or pink→purple).
4. `patchMemberFlags(publicId, { isNextGroupLeader: newValue })` fires in the background.
5. **Success:** no further action needed — local state already matches backend.
6. **Failure:** flip the flag back, re-trigger the signal (revert), and show a brief error toast.

No loading spinner is shown. Concurrent clicks on different cells are independent.

---

## 4. Scope — What Is NOT Changing

- No new backend fields. `isNextGroupLeader` already exists; `patchMemberFlags` already handles it.
- `computeCategory`, `buildMatrix`, and `CATEGORY_CONFIG` are untouched.
- Filter behavior for all other legend buttons is unchanged.
- The pulsing ring animation only applies while `예비순장` mode is active.
- No new routes, services, or components. All changes are in:
  - `church-groups-list.component.ts` — `isDimmed` logic, click handler, optimistic update
  - `church-groups-list.component.html` — `.cg-candidate` class binding, click binding on cells
  - Inline styles in the component — `@keyframes` for the pulsing ring

---

## 5. Error Handling

- On `patchMemberFlags` failure: revert the local flag and show a toast (can use a simple Angular signal-based message, or whatever toast mechanism exists in the app).
- No retry logic needed — the admin can simply click again.
