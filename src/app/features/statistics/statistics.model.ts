/** `ChartDataDto` — one labelled count, e.g. `{ label: '자매', value: 52 }`. */
export interface ChartDatum {
  label: string;
  value: number;
}

/** `GET /v1/statistics/dashboard` — `DashboardStatsDto`. */
export interface DashboardStats {
  totalMembers: number;
  newMembersYtd: number;
  averageAge: number;
  cityDistribution: ChartDatum[];
  ageDistribution: ChartDatum[];
  genderDistribution: ChartDatum[];
}
