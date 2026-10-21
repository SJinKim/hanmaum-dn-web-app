import { GuideReport } from './guide-report.model';
export type GuideServiceNumber = 1 | 2 | 3;
export type GuideCountField = 'adultCount' | 'schoolCount' | 'youthCount';
export interface GuideBaseCounts { adultCount: number | null; schoolCount: number | null; youthCount: number | null }
export interface GuideDetailEntry extends GuideBaseCounts { areaPublicId: string; serviceNumber: GuideServiceNumber }
export interface GuideCountTotals extends GuideBaseCounts { compatibleAdultCount: number | null; totalCount: number | null; complete: boolean }
export interface GuideSnapshotArea { areaPublicId: string; roomPublicId: string; roomName: string; label: string; displayOrder: number }
export interface GuideDetails {
  report: GuideReport;
  entries: { areaPublicId: string; serviceNumber: GuideServiceNumber; counts: GuideCountTotals }[];
  rooms: (GuideSnapshotArea & { counts: GuideCountTotals })[];
  services: { serviceNumber: GuideServiceNumber; counts: GuideCountTotals }[];
  totals: GuideCountTotals | null;
}
export interface GuideDetailsRequest { serviceDate: string; notes: string | null; entries: GuideDetailEntry[] }
/** Only preview arithmetic. The saved response remains canonical. */
export function guideSum(values: (number | null | undefined)[]): number | null {
  return !values.length || values.some(v => v == null) ? null : (values as number[]).reduce((sum, v) => sum + v, 0);
}
export function guideEntryTotal(entry: GuideDetailEntry): number | null {
  return guideSum([entry.adultCount, entry.schoolCount, ...(entry.serviceNumber === 3 ? [entry.youthCount] : [])]);
}
