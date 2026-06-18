/** Shared design tokens so every screen looks consistent. */

// Selest Security brand palette (deep space blue → light blue).
export const palette = {
  deepSpaceBlue: '#012A4A',
  yaleBlue: '#013A63',
  yaleBlue2: '#01497C',
  yaleBlue3: '#014F86',
  richCerulean: '#2A6F97',
  cerulean: '#2C7DA0',
  airForceBlue: '#468FAF',
  steelBlue: '#61A5C2',
  skyBlueLight: '#89C2D9',
  lightBlue: '#A9D6E5',
};

export const colors = {
  // Raw brand colors, available by name.
  ...palette,

  // Semantic tokens mapped onto the brand palette.
  navy: palette.deepSpaceBlue, // headers, splash, avatar, dark chips
  navyLight: palette.yaleBlue,
  primary: palette.yaleBlue3, // primary CTAs, links, active states
  accent: palette.cerulean, // secondary accent

  background: '#EEF4F8', // soft blue-tinted app background
  card: '#FFFFFF',
  text: '#06243B', // near deep-space blue for readable body text
  textMuted: '#5A7588', // blue-grey secondary text
  border: '#D3E3EC', // light blue-tinted divider

  // Broadcast types. Emergency stays red per the high-priority requirement;
  // general uses the brand cerulean so it reads as routine, not urgent.
  emergency: '#C0392B',
  emergencyBg: '#FBEAE8',
  general: palette.cerulean,
  generalBg: '#E6F1F6',

  success: '#1B9C57',
  white: '#FFFFFF',
};

export const spacing = (n: number) => n * 8;

export const radius = { sm: 8, md: 12, lg: 16 };
