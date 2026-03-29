export interface BoundingBox {
  left: string;
  top: string;
  width: string;
  height: string;
  label: string;
}

export interface CameraZone {
  id: string;
  zone: string;
  name: string;
  status: 'live' | 'active' | 'offline';
  videoSrc: string | null;
  bgStyle: string | null;
  timeOffset: number;
  incident: boolean;
  bbox: BoundingBox | null;
}

export interface FaceRecord {
  id: string;
  risk: 'high' | 'medium' | 'low';
  incidents: number;
  lastSeen: string;
  seed: number;
  active: boolean;
}

export interface Alert {
  type: 'face-match' | 'concealment' | 'suspicion';
  badgeText: string;
  time: string;
  text: string;
  meta: string;
  link: string;
  at: number;
  triggerActive: boolean;
  triggerFaceDB: boolean;
}

export const CAMERA_ZONES: CameraZone[] = [
  { id: 'A', zone: 'ZONE A', name: 'Front Entrance', status: 'live', videoSrc: null, bgStyle: null, timeOffset: -46, incident: false, bbox: null },
  { id: 'B', zone: 'ZONE B', name: 'Drinks Aisle', status: 'active', videoSrc: '/videos/shoplift1.mp4', bgStyle: null, timeOffset: 4, incident: true, bbox: { left: '30%', top: '15%', width: '38%', height: '65%', label: 'CONCEALMENT DETECTED' } },
  { id: 'C', zone: 'ZONE C · TOBACCO', name: 'Tobacco Counter', status: 'active', videoSrc: null, bgStyle: 'linear-gradient(135deg,#1e1e18 0%,#2a2a20 60%,#1e1e18 100%)', timeOffset: -83, incident: false, bbox: null },
  { id: 'D', zone: 'ZONE D', name: 'Self-Checkout', status: 'offline', videoSrc: null, bgStyle: '#101010', timeOffset: 0, incident: false, bbox: null },
  { id: 'E', zone: 'ZONE E', name: 'Stockroom', status: 'live', videoSrc: null, bgStyle: 'linear-gradient(135deg,#181c18 0%,#222820 50%,#181c18 100%)', timeOffset: -7, incident: false, bbox: null },
  { id: 'F', zone: 'ZONE F', name: 'Car Park', status: 'live', videoSrc: null, bgStyle: 'linear-gradient(180deg,#111 0%,#1c1e18 100%)', timeOffset: 2, incident: false, bbox: null },
];

export const FACE_RECORDS: FaceRecord[] = [
  { id: 'ZF-4829-LKQM', risk: 'high', incidents: 7, lastSeen: 'Hoy 14:22 · Entrada', seed: 42, active: true },
  { id: 'ZF-1173-BXWP', risk: 'high', incidents: 4, lastSeen: 'Hace 2 días · Bebidas', seed: 17, active: false },
  { id: 'ZF-7792-PHJA', risk: 'high', incidents: 5, lastSeen: 'Hace 3 días · Tabaco', seed: 83, active: false },
  { id: 'ZF-8801-QQRT', risk: 'medium', incidents: 2, lastSeen: 'Hace 5 días · Caja', seed: 29, active: false },
  { id: 'ZF-2244-CWSX', risk: 'medium', incidents: 3, lastSeen: 'Hace 4 días · Caja', seed: 56, active: false },
  { id: 'ZF-5503-RYLB', risk: 'medium', incidents: 2, lastSeen: 'Hace 6 días · Entrada', seed: 71, active: false },
  { id: 'ZF-3356-MNVK', risk: 'low', incidents: 1, lastSeen: 'Hace 1 semana · Entrada', seed: 34, active: false },
  { id: 'ZF-9915-DKFM', risk: 'low', incidents: 1, lastSeen: 'Hace 2 semanas · Bebidas', seed: 91, active: false },
];

export const ALERT_SEQUENCE: Alert[] = [
  { type: 'suspicion', badgeText: 'SUSPICION', time: '14:22:08', text: 'Individual loitering near Drinks Aisle for 3+ minutes. No purchase detected.', meta: 'ZONE B · DRINKS AISLE', link: 'REVIEW FOOTAGE', at: 6000, triggerActive: false, triggerFaceDB: false },
  { type: 'concealment', badgeText: 'CONCEALMENT', time: '14:22:14', text: 'Possible item concealment detected. Subject placed item inside jacket — Drinks Aisle.', meta: 'ZONE B · DRINKS AISLE', link: 'REVIEW FOOTAGE', at: 10500, triggerActive: true, triggerFaceDB: false },
  { type: 'face-match', badgeText: 'FACE MATCH', time: '14:22:19', text: 'Vector match: ZF-4829-LKQM — 94% confidence. Flagged high-risk.', meta: 'ZONE B · DRINKS AISLE', link: 'VIEW PROFILE', at: 15000, triggerActive: false, triggerFaceDB: true },
];
