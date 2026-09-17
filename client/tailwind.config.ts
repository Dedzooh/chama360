import type { Config } from 'tailwindcss';
import { tailwindTheme } from './src/design-system/theme';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: tailwindTheme.colors,
      fontFamily: tailwindTheme.fontFamily,
      spacing: tailwindTheme.spacing,
      borderRadius: tailwindTheme.borderRadius,
      boxShadow: tailwindTheme.boxShadow,
      transitionDuration: tailwindTheme.transitionDuration,
    },
  },
} satisfies Config;
