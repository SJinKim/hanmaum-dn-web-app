import { BadgeVariant } from './variant-tokens';

/**
 * Figma: Table assembly (117:136) and ListCard (118:365) render the same record.
 *
 * "AG-Grid with 8 columns is not survivable at 390px, so on Phone each record
 * becomes a card." Both presentations therefore read one interface: a screen
 * swaps `app-data-table` for a list of `app-list-card` without reshaping data.
 *
 * The field names are the Figma cell types: AvatarName, Text, Badge, Date,
 * Progress. Actions are not data — the table renders them when asked to.
 */
export interface DataRecord {
  /** Stable key for row tracking and selection — the backend `publicId`. */
  id: string;
  /** AvatarName cell / ListCard title. */
  title: string;
  /** Avatar glyph; defaults to the first character of `title`. */
  initials?: string;
  /** Text cell / ListCard subtitle. */
  subtitle?: string;
  /** Badge cell / ListCard badge. */
  badge?: DataRecordBadge;
  /** Date cell / ListCard meta. */
  meta?: string;
  /** Progress cell — table only; the card has no room for it. */
  progress?: DataRecordProgress;
}

export interface DataRecordBadge {
  variant: BadgeVariant;
  /** Always present: colour is never the only signal for a status. */
  label: string;
}

export interface DataRecordProgress {
  /** Percentage, 0–100. */
  value: number;
  /** Visible value text, e.g. `8/12`. */
  label: string;
}

/** Figma: Table/Cell type axis (114:85). */
export type DataColumnType = 'avatar-name' | 'text' | 'badge' | 'date' | 'progress' | 'actions';

export interface DataColumn {
  type: DataColumnType;
  /** Header label — rendered as overline, per Table/HeaderCell (113:69). */
  header: string;
  /** CSS width; defaults to the Figma assembly width for the type. */
  width?: string;
  /** Actions are never sortable. */
  sortable?: boolean;
}

/** Which `DataRecord` field a column of each type sorts on. */
export const COLUMN_SORT_FIELD: Record<DataColumnType, string | null> = {
  'avatar-name': 'title',
  text: 'subtitle',
  badge: 'badge.label',
  date: 'meta',
  progress: 'progress.value',
  actions: null,
};

/** Default column widths from the Figma Table assembly (117:136). */
export const COLUMN_WIDTH: Record<DataColumnType, string> = {
  'avatar-name': '220px',
  text: '220px',
  badge: '160px',
  date: '160px',
  progress: '160px',
  actions: '140px',
};
