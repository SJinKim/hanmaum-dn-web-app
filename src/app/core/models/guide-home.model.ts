/** Generated contract: ops PR71, server#333. No dependency on the Guide feature. */
export interface GuideHomeReport {
  publicId: string; serviceDate: string; version: number; reportMode: 'SUMMARY_ONLY' | 'DETAILED'; complete: boolean;
  service1Count: number | null; service2Count: number | null; service3Count: number | null;
  totalCount: number | null; previousWeekDelta: number | null; notes: string | null;
}
export interface GuideHomeCounts {
  adultCount: number | null; youthCount: number | null; compatibleAdultCount: number | null;
  schoolCount: number | null; totalCount: number | null; complete: boolean;
}
export interface GuideHomeAttendance {
  report: GuideHomeReport;
  entries: { areaPublicId: string; serviceNumber: number; counts: GuideHomeCounts }[];
  rooms: { areaPublicId: string; roomPublicId: string; roomName: string; label: string; displayOrder: number; counts: GuideHomeCounts }[];
  services: { serviceNumber: number; counts: GuideHomeCounts }[];
  totals: GuideHomeCounts | null;
}
export interface GuideHomeSnapshot {
  asOf: string; timeZone: string; currentSunday: string; snapshotVersion: string;
  status: 'EMPTY' | 'PARTIAL' | 'COMPLETE'; waitingForCurrentSunday: boolean;
  attendance: GuideHomeAttendance | null; currentSundayReport: GuideHomeReport | null;
  lastFourReports: GuideHomeReport[];
  metrics: {
    reportDate: string | null; totalCount: number | null; referenceDate: string | null; referenceTotal: number | null;
    absoluteChange: number | null; percentChange: number | null; percentReason: 'NO_CURRENT_DATA' | 'NO_BASELINE_DATA' | 'ZERO_BASELINE' | null;
    meanLastFour: number | null; meanReportCount: number; meanFrom: string | null; meanTo: string | null;
  };
  timeline: { serviceDate: string; service1Count: number | null; service2Count: number | null; service3Count: number | null; totalCount: number | null }[];
  sharesReportDate: string | null;
  shares: { serviceNumber: number; count: number | null; percent: number | null }[];
  sharesReason: 'NO_COMPLETE_REPORT' | 'ZERO_TOTAL' | null;
}
