/**
 * Member training & ministry activity models.
 *
 * Training is persisted via the backend training catalog
 * (`GET /trainings/catalog?activeOnly=false`) and the per-member set
 * (`GET /members/{id}` → `trainings`, `PUT /members/{id}/trainings`).
 * The catalog is the single source of truth for which courses exist, what they are
 * called and how they are ordered — the dashboard keeps no hardcoded course list.
 *
 * Courses are identified by the catalog's stable `code`; the member DTOs
 * ({@link UserTraining}, {@link SummaryTraining}) only carry the English `name`, so
 * every display or edit path joins back onto the catalog by name. Once the server
 * ships `code` in those DTOs, {@link catalogEntryByName} is the only place to change.
 *
 * Ministry assignments are admin-managed on the member form: `GET /members/{id}` →
 * `ministries` returns {@link MinistryHistory} (start/end-date assignments), edited via
 * `PUT /members/{id}/ministries`. The catalog (`GET /ministries`) is modelled as
 * {@link MinistryCatalogEntry}; the form value is {@link MinistryFormValue} and the
 * request item is {@link MemberMinistryItem}.
 */

import { AppLang } from '../i18n/language';

// --- TRAINING ---

/** Enrolment lifecycle, mirroring the server's `TrainingStatus` enum. */
export type TrainingStatus =
  | 'APPLIED'
  | 'ENROLLED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'DROPPED'
  | 'UNKNOWN';

/** All statuses in lifecycle order — drives the edit form's status select. */
export const TRAINING_STATUSES: readonly TrainingStatus[] = [
  'APPLIED',
  'ENROLLED',
  'IN_PROGRESS',
  'COMPLETED',
  'DROPPED',
  'UNKNOWN',
] as const;

/**
 * Coarse bucket behind the chip colors and the grid filter: six statuses are too many
 * to check off one by one, and only these three distinctions are acted on in the UI.
 */
export type TrainingStatusGroup = 'ACTIVE' | 'COMPLETED' | 'INACTIVE';

const TRAINING_STATUS_GROUPS: Record<TrainingStatus, TrainingStatusGroup> = {
  APPLIED:     'ACTIVE',
  ENROLLED:    'ACTIVE',
  IN_PROGRESS: 'ACTIVE',
  COMPLETED:   'COMPLETED',
  DROPPED:     'INACTIVE',
  UNKNOWN:     'INACTIVE',
};

/** Bucket for a status; unknown values from a newer server fall back to INACTIVE. */
export function trainingStatusGroup(status: TrainingStatus): TrainingStatusGroup {
  return TRAINING_STATUS_GROUPS[status] ?? 'INACTIVE';
}

/** Catalog entry from `GET /trainings/catalog?activeOnly=false` (ADMIN-only). */
export interface TrainingCatalogEntry {
  publicId: string;
  /** Stable identifier, e.g. 'QT_BASIC_SEMINAR'. Never shown to the user. */
  code: string;
  /** English long name — the value the member DTOs send as `name`. */
  name: string;
  /** Korean name shown while the UI language is Korean. */
  nameKo: string;
  category: string | null;
  sortOrder: number;
  hasCohorts: boolean;
  /** Retired courses stay in the catalog so historic member rows still resolve. */
  isActive: boolean;
  prerequisiteCode: string | null;
}

/** A member's training as returned by the backend (`GET /members/{id}` → `trainings`). */
export interface UserTraining {
  trainingPublicId: string;
  /** Catalog `name` (English long name), e.g. 'Quiet Time Basic Seminar'. */
  name: string;
  status: TrainingStatus;
  completedAt: string | null;   // ISO date 'YYYY-MM-DD', null unless completed
}

/** A single item in the `PUT /members/{id}/trainings` request body. */
export interface MemberTrainingItem {
  trainingPublicId: string;
  status: TrainingStatus;
  completedAt: string | null;
}

/** A member's training as shown on the grid chip (`GET /members` → summary). */
export interface SummaryTraining {
  /** Catalog `name` (English long name), e.g. 'One-to-One Discipleship Training'. */
  name: string;
  status: TrainingStatus;
}

/** The training form's per-card value (catalog code + completion month/year + status). */
export interface TrainingFormValue {
  code: string | null;
  month: number | null;
  year: number | null;
  status: TrainingStatus;
}

// --- CATALOG LOOKUPS ---

/** Catalog entry for a stable `code`, or undefined. */
export function catalogEntryByCode(
  catalog: TrainingCatalogEntry[],
  code: string | null,
): TrainingCatalogEntry | undefined {
  if (!code) return undefined;
  return catalog.find(e => e.code === code);
}

/**
 * Catalog entry for the English `name` carried by the member DTOs, or undefined.
 * The only place the dashboard joins on a name instead of a code — see the file header.
 */
export function catalogEntryByName(
  catalog: TrainingCatalogEntry[],
  name: string | null,
): TrainingCatalogEntry | undefined {
  if (!name) return undefined;
  return catalog.find(e => e.name === name);
}

/** Display name of a catalog entry in the active UI language. */
export function trainingLabel(entry: TrainingCatalogEntry, lang: AppLang): string {
  return lang === 'ko' ? (entry.nameKo || entry.name) : entry.name;
}

/**
 * Display label for a member training, resolved through the catalog.
 * Falls back to the raw DTO name so a course missing from the catalog still reads
 * as something rather than as a blank or a translation key.
 */
export function trainingLabelForName(
  catalog: TrainingCatalogEntry[],
  name: string,
  lang: AppLang,
): string {
  const entry = catalogEntryByName(catalog, name);
  return entry ? trainingLabel(entry, lang) : name;
}

/**
 * Selectable courses in catalog order: active ones, plus any code in `keepCodes` —
 * a member holding a retired course must still see it in their own select.
 */
export function trainingOptions(
  catalog: TrainingCatalogEntry[],
  lang: AppLang,
  keepCodes: readonly string[] = [],
): { value: string; label: string }[] {
  return catalog
    .filter(e => e.isActive || keepCodes.includes(e.code))
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(e => ({ value: e.code, label: trainingLabel(e, lang) }));
}

// --- MINISTRY ---

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

/** Ministry option from `GET /ministries` (summary list). */
export interface MinistryCatalogEntry {
  publicId: string;
  title: string;
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

// --- DATE OPTIONS (shared) ---

/** Months 1–12, two-digit labels "01"–"12". */
export const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: String(i + 1).padStart(2, '0'),
}));

/** Years 2000–2035, two-digit labels "00"–"35" (full-year value). */
export const YEAR_OPTIONS = Array.from({ length: 36 }, (_, i) => ({
  value: 2000 + i,
  label: String(i).padStart(2, '0'),
}));

// --- TRAINING SHAPE MAPPING (form <-> backend) ---

/** Builds the completion date pinned to the first of the month, or null if incomplete. */
export function completedAtFromMonthYear(month: number | null, year: number | null): string | null {
  if (!month || !year) return null;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/** Splits an ISO date 'YYYY-MM-DD' into month + year (nulls when absent). */
export function monthYearFromCompletedAt(iso: string | null): { month: number | null; year: number | null } {
  if (!iso) return { month: null, year: null };
  const [year, month] = iso.split('-').map(Number);
  return { month: month ?? null, year: year ?? null };
}

/** Maps a backend training to the edit-form value, or null when the catalog lacks it. */
export function mapUserTrainingToFormValue(
  ut: UserTraining,
  catalog: TrainingCatalogEntry[],
): TrainingFormValue | null {
  const entry = catalogEntryByName(catalog, ut.name);
  if (!entry) return null;
  const { month, year } = monthYearFromCompletedAt(ut.completedAt);
  return { code: entry.code, month, year, status: ut.status };
}

/** Maps an edit-form value + catalog to a PUT item, or null if it can't be resolved. */
export function mapFormValueToItem(
  value: TrainingFormValue,
  catalog: TrainingCatalogEntry[],
): MemberTrainingItem | null {
  const entry = catalogEntryByCode(catalog, value.code);
  if (!entry) return null;
  const completedAt =
    value.status === 'COMPLETED' ? completedAtFromMonthYear(value.month, value.year) : null;
  return { trainingPublicId: entry.publicId, status: value.status, completedAt };
}

/** first-of-month ISO → {month, year}; reuses the training helper. */
export function firstOfMonthToMonthYear(iso: string | null): { month: number | null; year: number | null } {
  return monthYearFromCompletedAt(iso);
}

/** {month, year} → first-of-month ISO 'YYYY-MM-01', or null. Reuses the training helper. */
export function monthYearToFirstOfMonth(month: number | null, year: number | null): string | null {
  return completedAtFromMonthYear(month, year);
}
