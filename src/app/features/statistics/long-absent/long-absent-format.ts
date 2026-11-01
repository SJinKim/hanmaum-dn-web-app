import { LongAbsence, LongAbsenceActor } from '../../../core/models/long-absent.model';

/** UTF-16 code units, as the server counts — an emoji may be two. */
export function memoLength(text: string): number {
  return text.length;
}

/**
 * The full memo after an addition (#277 AK 5): the API replaces, it does not
 * append, so the existing memo, a line break and the new details go out together.
 * Blank details add nothing.
 */
export function memoWithAddition(existing: string | null, addition: string): string | null {
  const details = addition.trim();
  if (!details) return null;
  return existing ? `${existing}\n${details}` : details;
}

/** An ISO calendar day, formatted without any time-zone shift. */
export function formatDay(day: string, locale: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }).format(date);
}

/** An instant, shown in the church's zone. */
export function formatInstant(instant: string, locale: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return instant;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Berlin' }).format(date);
}

/** An actor: the member's name, else the bare account, else nothing. */
export function actorName(member: Pick<LongAbsenceActor, 'fullName'> | null, subject: string | null): string | null {
  return member?.fullName ?? subject ?? null;
}

/** Who marked the phase as contacted. */
export function contactActor(row: LongAbsence): string | null {
  return actorName(row.contactedByMember, row.contactedBy);
}

export function displayName(row: Pick<LongAbsence, 'fullName' | 'discriminator'>): string {
  return row.discriminator ? `${row.fullName} (${row.discriminator})` : row.fullName;
}
