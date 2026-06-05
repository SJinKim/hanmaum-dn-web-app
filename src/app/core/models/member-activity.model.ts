/**
 * Member training & ministry activity models.
 *
 * Training is persisted via the backend training catalog (`GET /trainings`) and the
 * per-member set (`GET /members/{id}` → `trainings`, `PUT /members/{id}/trainings`).
 * The catalog references trainings by `publicId`; the form models them as the
 * `TrainingType` enum below. The mapping helpers at the bottom of this file bridge
 * the two shapes.
 *
 * Ministry is read-only here: `GET /members/{id}` → `ministries` returns
 * {@link MinistryHistory} (a projection of the member's ministry registrations).
 * Registrations are created/managed under the Ministry feature, not the member form.
 */

// --- TRAINING ---

export type TrainingType = 'QTBS' | 'ONE_ON_ONE' | 'DISCIPLESHIP';
export type TrainingStatus = 'IN_PROGRESS' | 'COMPLETED';

/** Catalog entry from `GET /trainings`. */
export interface TrainingCatalogEntry {
  publicId: string;
  name: string;
  sortOrder: number;
}

/** A member's training as returned by the backend (`GET /members/{id}` → `trainings`). */
export interface UserTraining {
  trainingPublicId: string;
  name: string;            // catalog name, e.g. 'QTBS' | '1on1' | 'Discipleship'
  status: TrainingStatus;
  completedAt: string | null;   // ISO date 'YYYY-MM-DD', null while in progress
}

/** A single item in the `PUT /members/{id}/trainings` request body. */
export interface MemberTrainingItem {
  trainingPublicId: string;
  status: TrainingStatus;
  completedAt: string | null;
}

/** A member's training as shown on the grid chip (`GET /members` → summary). */
export interface SummaryTraining {
  name: string;            // catalog name, e.g. 'QTBS' | '1on1' | 'Discipleship'
  status: TrainingStatus;
}

/** The training form's per-card value (type + completion month/year + status). */
export interface TrainingFormValue {
  type: TrainingType | null;
  month: number | null;
  year: number | null;
  status: TrainingStatus;
}

export const TRAINING_TYPE_LABELS: Record<TrainingType, string> = {
  QTBS:         'QTBS',
  ONE_ON_ONE:   '1on1',
  DISCIPLESHIP: 'Discipleship',
};

export const TRAINING_TYPE_OPTIONS = Object.entries(TRAINING_TYPE_LABELS)
  .map(([value, label]) => ({ value: value as TrainingType, label }));

// --- MINISTRY ---

/**
 * A member's ministry registration as returned by the backend
 * (`GET /members/{id}` → `ministries`). This is the *real* persisted shape:
 * a member registered to a Ministry entity for a `registrationPeriod`
 * (a 4-char year, e.g. "2024") with a registration status. It is read-only
 * here — registrations are managed under the Ministry feature, not the member form.
 */
export interface MinistryHistory {
  ministryPublicId: string;
  name: string;
  registrationPeriod: string;   // 4-char year, e.g. "2024"
  status: string;               // RegistrationStatus, e.g. "APPROVED" | "PENDING"
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

export const MAX_TRAININGS = 3;

// --- TRAINING SHAPE MAPPING (form <-> backend) ---

/** Reverse of TRAINING_TYPE_LABELS: catalog name → form enum. */
const TRAINING_NAME_TO_TYPE: Record<string, TrainingType> = Object.fromEntries(
  Object.entries(TRAINING_TYPE_LABELS).map(([type, name]) => [name, type as TrainingType]),
);

/** Resolves a catalog/DTO name (e.g. '1on1') to the form enum ('ONE_ON_ONE'), or null. */
export function trainingTypeForName(name: string): TrainingType | null {
  return TRAINING_NAME_TO_TYPE[name] ?? null;
}

/** Looks up a training's catalog publicId by matching the form type's label, or null. */
export function trainingPublicIdForType(
  type: TrainingType,
  catalog: TrainingCatalogEntry[],
): string | null {
  const name = TRAINING_TYPE_LABELS[type];
  return catalog.find(c => c.name === name)?.publicId ?? null;
}

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

/** Maps a backend training to the edit-form value, or null if its name is unknown. */
export function mapUserTrainingToFormValue(ut: UserTraining): TrainingFormValue | null {
  const type = trainingTypeForName(ut.name);
  if (!type) return null;
  const { month, year } = monthYearFromCompletedAt(ut.completedAt);
  return { type, month, year, status: ut.status };
}

/** Maps an edit-form value + catalog to a PUT item, or null if it can't be resolved. */
export function mapFormValueToItem(
  value: TrainingFormValue,
  catalog: TrainingCatalogEntry[],
): MemberTrainingItem | null {
  if (!value.type) return null;
  const trainingPublicId = trainingPublicIdForType(value.type, catalog);
  if (!trainingPublicId) return null;
  const completedAt =
    value.status === 'COMPLETED' ? completedAtFromMonthYear(value.month, value.year) : null;
  return { trainingPublicId, status: value.status, completedAt };
}
