/** Shared design tokens — matched to the Selest web app's theme. */

// The web app's app-screens use a dark indigo/black-russian background with
// gold (Golden Chalice) accents, indigo cards, and Poppins type. These hex
// values are taken straight from the web app:
//   page bg  #0A001C (Black Russian / web gradient base)
//   card     #2D2D52   card hover/active/border #3D3D62   input #1A1A3A
//   gold     #AC8D46 (web_golden, Golden Chalice)   highlight #FACC15 (yellow-400)
//   danger   #DC2626 (red-600)
export const palette = {
  blackRussian: '#0A001C', // page background
  spaceCadet: '#000027', // web_purple (alt deep bg)
  midnight: '#1A1A3A', // input fields
  indigo: '#2D2D52', // cards / surfaces
  indigoLight: '#3D3D62', // hover / active / borders
  golden: '#AC8D46', // Golden Chalice — brand primary
  goldenBright: '#FACC15', // yellow-400 — highlights / icons
  cloud: '#F2F0EF', // near-white text
  gray: '#D9D9D9',
};

export const colors = {
  // Raw brand colors, available by name.
  ...palette,

  // Semantic tokens (dark theme to match the web app).
  navy: palette.blackRussian, // headers, splash, avatar, dark chips
  navyLight: palette.indigo,
  primary: palette.golden, // primary CTAs, links, active states
  onPrimary: palette.blackRussian, // text/icons on gold buttons (web uses black on gold)
  accent: palette.goldenBright, // highlight accent (icons, links)

  background: palette.blackRussian, // dark app background
  card: palette.indigo, // raised cards
  inputBg: palette.midnight, // text inputs
  text: palette.cloud, // light body text
  textMuted: '#A7A2B5', // muted blue-grey (≈ tailwind gray-400 on dark)
  border: palette.indigoLight, // dark divider

  // Broadcast types. Emergency stays red; general uses the brand gold.
  emergency: '#DC2626', // red-600 (matches web)
  emergencyBg: '#2A1316', // dark red-tinted surface
  general: palette.golden,
  generalBg: palette.indigoLight,

  success: '#56C162',
  white: '#FFFFFF',
};

export const spacing = (n: number) => n * 8;

export const radius = { sm: 8, md: 12, lg: 16 };

// Poppins type to match the web app (loaded in App.tsx).
export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
};
