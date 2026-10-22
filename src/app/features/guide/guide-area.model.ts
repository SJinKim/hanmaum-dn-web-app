export interface GuideArea {
  areaPublicId: string;
  roomPublicId: string;
  roomName: string;
  label: string;
  displayOrder: number;
  active: boolean;
  version: number;
}
export interface GuideRoom {
  publicId: string;
  name: string;
  floorPublicId: string;
  floorName: string;
}
export type GuideAreaSettings = Pick<GuideArea, 'roomPublicId' | 'label' | 'displayOrder' | 'active'>;

/** The UI is one-based; never round, truncate or accept exponent/decimal tokens. */
export function parseGuideOrder(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const order = Number(value);
  return Number.isSafeInteger(order) && order >= 1 && order <= 2147483648 ? order - 1 : null;
}
