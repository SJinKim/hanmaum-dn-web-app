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
 *
 * The named fields hold one value per cell type, which is all the ListCard has
 * room for. A table with more columns than that — two badges, three text
 * columns — puts the rest in `cells` and points each column at its key (#69).
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
  /** Table-only values, read by columns that set `key`. */
  cells?: Readonly<Record<string, DataCellValue>>;
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

/**
 * One keyed cell. A column renders the value its type expects and falls back to
 * text otherwise — a 합계 row can carry `75%` where the rows carry a bar.
 */
export type DataCellValue = string | number | DataRecordBadge | DataRecordProgress | null | undefined;

/**
 * Figma: Table/Cell type axis (114:85). `custom` is not a Figma cell: it hands
 * the cell to an `ng-template[appDataCell]` of the same key, for content the
 * kit has no cell for (MemberPill tags, the approve flow).
 */
export type DataColumnType = 'avatar-name' | 'text' | 'badge' | 'date' | 'progress' | 'actions' | 'custom';

/** Text weight of a text or date cell. */
export type DataColumnTone = 'strong' | 'default' | 'muted';

export interface DataColumn {
  type: DataColumnType;
  /** Header label — rendered as overline, per Table/HeaderCell (113:69). */
  header: string;
  /**
   * Reads `record.cells[key]` instead of the named field for the type, so a
   * table can have any number of text or badge columns. Required for `custom`,
   * where it names the cell template.
   */
  key?: string;
  /**
   * What the column sorts by. In client sorting a field path on the record; with
   * `externalSort` the value `sortChange` emits, e.g. a server sort property.
   * Defaults to the field the column shows; `custom` sorts only with one.
   */
  sortKey?: string;
  /** CSS width; defaults to the Figma assembly width for the type. */
  width?: string;
  /** Actions are never sortable. */
  sortable?: boolean;
  /** `end` for figures, so digits line up. Defaults to `start`. */
  align?: 'start' | 'end';
  /** Defaults to `strong` for avatar-name, `muted` for date, `default` otherwise. */
  tone?: DataColumnTone;
}

/** Which `DataRecord` field a column of each type sorts on. */
export const COLUMN_SORT_FIELD: Record<DataColumnType, string | null> = {
  'avatar-name': 'title',
  text: 'subtitle',
  badge: 'badge.label',
  date: 'meta',
  progress: 'progress.value',
  actions: null,
  custom: null,
};

/** Default column widths from the Figma Table assembly (117:136). */
export const COLUMN_WIDTH: Record<DataColumnType, string> = {
  'avatar-name': '220px',
  text: '220px',
  badge: '160px',
  date: '160px',
  progress: '160px',
  actions: '140px',
  custom: '220px',
};

/** Unique per table: tracks header and body cells across column changes. */
export function columnId(column: DataColumn): string {
  return column.key ?? `${column.type}:${column.header}`;
}

/**
 * The field a column sorts on, or `null` when it cannot sort — actions,
 * `sortable: false`, or a custom column without a `sortKey`. A keyed column
 * sorts on its cell, so PrimeNG's dot-path lookup reaches `cells.<key>`.
 */
export function columnSortField(column: DataColumn): string | null {
  if (column.sortable === false || column.type === 'actions') return null;
  if (column.sortKey) return column.sortKey;
  if (!column.key || column.type === 'avatar-name') return COLUMN_SORT_FIELD[column.type];
  if (column.type === 'custom') return null;
  if (column.type === 'badge') return `cells.${column.key}.label`;
  if (column.type === 'progress') return `cells.${column.key}.value`;
  return `cells.${column.key}`;
}

/**
 * The value a column shows for a record — its cell when keyed, else the named
 * field. An avatar-name column always shows the title; its key only names it.
 */
export function cellValue(record: DataRecord, column: DataColumn): DataCellValue {
  if (column.key && column.type !== 'avatar-name') return record.cells?.[column.key];
  switch (column.type) {
    case 'avatar-name':
      return record.title;
    case 'text':
      return record.subtitle;
    case 'badge':
      return record.badge;
    case 'date':
      return record.meta;
    case 'progress':
      return record.progress;
    default:
      return undefined;
  }
}

/** The cell as a badge, or `null` when it holds anything else. */
export function asBadge(value: DataCellValue): DataRecordBadge | null {
  return typeof value === 'object' && value !== null && 'variant' in value ? value : null;
}

/** The cell as a progress value, or `null` when it holds anything else. */
export function asProgress(value: DataCellValue): DataRecordProgress | null {
  return typeof value === 'object' && value !== null && 'value' in value ? value : null;
}

/** The cell as text; objects render their label, a missing value renders empty. */
export function cellText(value: DataCellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return value.label;
  return String(value);
}

/** The tone a column's text renders in when it sets none. */
export function columnTone(column: DataColumn): DataColumnTone {
  if (column.tone) return column.tone;
  if (column.type === 'avatar-name') return 'strong';
  if (column.type === 'date') return 'muted';
  return 'default';
}
