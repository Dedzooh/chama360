import { designTokens } from './tokens';

const palette = {
  emerald: designTokens.colors.emerald,
  navy: designTokens.colors.navy,
  gold: designTokens.colors.gold,
  success: designTokens.colors.success,
  warning: designTokens.colors.warning,
  error: designTokens.colors.error,
  info: designTokens.colors.info,
  neutral: designTokens.colors.neutral,
};

export const tailwindTheme = {
  colors: {
    primary: palette.emerald[600],
    'primary-strong': palette.emerald[800],
    secondary: palette.navy[700],
    'secondary-strong': palette.navy[800],
    accent: palette.gold[500],
    success: palette.success[600],
    warning: palette.warning[600],
    error: palette.error[600],
    info: palette.info[600],
    background: {
      page: designTokens.colors.background.page,
      subtle: designTokens.colors.background.subtle,
      raised: designTokens.colors.background.raised,
      inset: designTokens.colors.background.inset,
      dark: designTokens.colors.background.darkPage,
    },
    text: {
      primary: designTokens.colors.text.primary,
      secondary: designTokens.colors.text.secondary,
      muted: designTokens.colors.text.muted,
      inverse: designTokens.colors.text.inverse,
    },
    emerald: palette.emerald,
    navy: palette.navy,
    gold: palette.gold,
    successScale: palette.success,
    warningScale: palette.warning,
    errorScale: palette.error,
    infoScale: palette.info,
    neutral: palette.neutral,
  },
  fontFamily: {
    display: [designTokens.typography.fontFamily.display],
    body: [designTokens.typography.fontFamily.body],
    mono: [designTokens.typography.fontFamily.mono],
  },
  spacing: designTokens.spacing,
  borderRadius: designTokens.radii,
  boxShadow: designTokens.shadows,
  transitionDuration: designTokens.motion.duration,
} as const;

export type TailwindTheme = typeof tailwindTheme;
