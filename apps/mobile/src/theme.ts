/** Shared design tokens so every screen looks consistent. */
export const colors = {
  navy: '#0B1F3A',
  navyLight: '#13294B',
  primary: '#1E6FE0',
  background: '#F4F6FA',
  card: '#FFFFFF',
  text: '#11203A',
  textMuted: '#5B6B82',
  border: '#E2E8F0',

  // Emergency vs general broadcast styling (CEO: emergency = red/high priority).
  emergency: '#D6342C',
  emergencyBg: '#FDECEA',
  general: '#1E6FE0',
  generalBg: '#EAF1FD',

  success: '#1B9C57',
  white: '#FFFFFF',
};

export const spacing = (n: number) => n * 8;

export const radius = { sm: 8, md: 12, lg: 16 };
