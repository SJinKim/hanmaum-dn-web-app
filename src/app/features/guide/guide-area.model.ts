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
export type GuideAreaSettings = Pick<GuideArea, 'roomPublicId' | 'label' | 'active'>;
