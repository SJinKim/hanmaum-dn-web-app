# Phone Number Entry — Country Code Select + Mobile Validation

**Date:** 2026-05-30
**Status:** Approved, ready for implementation plan
**Area:** Member form (Add / Edit) and Member detail view

## Problem

The member phone field is a single free-text input with no validation
([member-edit.component.html:81](../../../src/app/features/members/member-edit/member-edit.component.html#L81)),
backed by `phoneNumber: string | null`
([member.model.ts:25](../../../src/app/core/models/member.model.ts#L25)).
Users enter numbers inconsistently and can mistype. We want to make correct
entry easy by separating the country dial code into a select and validating the
local number.

## Decisions (confirmed with user)

- **Countries:** Germany (`+49`) and Korea (`+82`) only.
- **Validation:** Mobile numbers only. Block save when a non-empty number is invalid.
- **Optional field:** Phone stays optional — an empty value is allowed and does not block save.
- **Storage:** E.164 normalized in the single existing `phoneNumber` field (e.g. `+491512345678`). **No backend/DTO change.**
- **Default country:** Germany (`DE`) for new members.
- **Scope:** Applies to Add Member, Edit Member (same component, both modes), and the read-only Detail view.

## Non-goals

- No third-party phone library (e.g. libphonenumber) — deliberately avoided for bundle size; two-country range/prefix checks are sufficient.
- No landline support.
- No change to the API contract, backend, or database.
- No new countries beyond DE/KR.

## Architecture

### 1. Pure helper module — `src/app/core/models/phone.util.ts`

No Angular dependencies; independently unit-testable.

```ts
export type PhoneCountry = 'DE' | 'KR';

export interface PhoneCountryOption {
  label: string;     // e.g. '🇩🇪 +49'
  value: PhoneCountry;
  dialCode: string;  // e.g. '+49'
}

export const PHONE_COUNTRIES: PhoneCountryOption[];
```

Functions:

- **`stripToDigits(input: string): string`** — removes spaces, dashes, parens, dots; keeps digits.
- **`isValidMobile(country: PhoneCountry, localInput: string): boolean`**
  - National number = `stripToDigits(localInput)` with a single leading `0` removed.
  - DE: `^1[567]\d{8,9}$` (starts 15/16/17, total 10–11 digits).
  - KR: `^1[016789]\d{7,8}$` (starts 10/11/16/17/18/19, total 9–10 digits).
- **`normalizeToE164(country, localInput): string | null`**
  - Returns `null` when input has no digits (empty → unset).
  - Otherwise: dial code + national number (leading `0` stripped), no separators. e.g. `('DE', '0151 2345678')` → `+491512345678`.
- **`parseE164(stored: string | null): { country: PhoneCountry; local: string }`**
  - Matches `+49` / `+82` prefix → sets country; remainder is the national number.
  - Re-adds a leading `0` to `local` for familiar display on edit.
  - Default / unrecognized prefix → `{ country: 'DE', local: <stored digits as-is> }`.
- **`formatForDisplay(stored: string | null): string`**
  - `null`/empty → `'—'`.
  - Recognized E.164 → grouped display, e.g. `+491512345678` → `+49 151 2345678`.
  - Unrecognized → returns the stored string unchanged.

### 2. Form — `member-edit.component.ts`

- Replace the single `phoneNumber` control with two controls:
  - `phoneCountry: ['DE']`
  - `phoneLocal: ['', mobileValidator]`
- **`mobileValidator`** (custom `ValidatorFn` on `phoneLocal`): returns `null` when the value is empty (optional); otherwise returns `{ invalidMobile: true }` when `isValidMobile(currentCountry, value)` is false. Reads the current country via the form group.
- Wire `phoneCountry.valueChanges` → `phoneLocal.updateValueAndValidity()` so switching country re-validates.
- **Save path:** build `phoneNumber: normalizeToE164(raw.phoneCountry, raw.phoneLocal) ?? undefined` for both create and update requests, replacing the current `raw.phoneNumber || undefined`.
- **Load path (`patchForm`):** `const { country, local } = parseE164(member.phoneNumber)` → patch `phoneCountry` and `phoneLocal`.

### 3. Template — `member-edit.component.html`

Replace the phone block ([lines 79–82](../../../src/app/features/members/member-edit/member-edit.component.html#L79-L82)):

- A narrow `p-select` bound to `phoneCountry` (`PHONE_COUNTRIES`, `optionLabel="label"`, `optionValue="value"`) sitting left of the phone `input` (same flex row).
- The text input binds to `phoneLocal`, placeholder reflecting the selected country (e.g. `0151 2345678`).
- Inline error below, matching the existing email-error pattern, shown when `phoneLocal.invalid && phoneLocal.touched`:
  *"Enter a valid German mobile number."* / *"Enter a valid Korean mobile number."* (message keyed off selected country).
- Applies in both Add and Edit modes (the block is outside any `@if (isEdit())`).

### 4. Detail view — `member-detail.component.html`

Replace the raw render at [line 93](../../../src/app/features/members/member-detail/member-detail.component.html#L93):
`{{ member()!.phoneNumber ?? '—' }}` → `{{ formatForDisplay(member()!.phoneNumber) }}`.
Expose `formatForDisplay` from the detail component (import from `phone.util.ts`).

## Data flow

```
Add/Edit:  user picks country + types local digits
           → mobileValidator gates submit
           → normalizeToE164() → phoneNumber (E.164) → API

Edit load: API phoneNumber (E.164) → parseE164() → {country, local} → form controls

Detail:    API phoneNumber (E.164) → formatForDisplay() → grouped string
```

## Error handling

- Empty phone → valid (optional), `normalizeToE164` yields `null` → field omitted from request.
- Non-empty invalid → `phoneLocal` invalid → `form.invalid` → existing `save()` guard marks touched and returns (no request).
- Unrecognized stored prefix on load → falls back to DE + raw digits so edit never crashes.

## Testing

Unit tests for `phone.util.ts` (the risk-bearing logic):
- `isValidMobile`: valid DE 015x/016x/017x; valid KR 010/011; reject DE landline `030…`; reject KR landline `02…`; reject too-short / too-long; tolerate spaces/dashes via `stripToDigits`.
- `normalizeToE164`: leading `0` stripped; separators removed; empty → `null`; DE and KR.
- `parseE164`: round-trips with `normalizeToE164`; re-adds leading `0`; unrecognized prefix → DE fallback.
- `formatForDisplay`: null → `—`; DE/KR grouping; unrecognized → unchanged.

Component-level: validator blocks save on bad number; switching country re-validates; load splits E.164 into the two controls.
