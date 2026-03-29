export const colors = {
  bg: '#eef0e2',
  sidebarBg: '#e8e9da',
  accent: '#c5e63a',
  dark: '#1a1a1a',
  borderLight: '#d4d5c6',
  textMuted: '#888',
  textBody: '#333',
  textLight: '#555',
  white: '#fff',
};

export const badgeColors = {
  live: { bg: '#28c840', text: '#fff' },
  active: { bg: '#c5e63a', text: '#1a1a1a' },
  offline: { bg: 'rgba(255,255,255,0.18)', text: 'rgba(255,255,255,0.55)' },
  'risk-high': { bg: '#ffd6de', text: '#c0304a' },
  'risk-medium': { bg: '#fff2c8', text: '#8a6500' },
  'risk-low': { bg: '#e8f5e9', text: '#2e7d32' },
  'face-match': { bg: '#ffd6de', text: '#c0304a' },
  concealment: { bg: '#ffe2c8', text: '#a03800' },
  suspicion: { bg: '#fff2c8', text: '#8a6500' },
} as const;

export type BadgeVariant = keyof typeof badgeColors;
