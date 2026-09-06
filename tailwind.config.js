export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    borderRadius: {
      none: '0',
    },
    extend: {
      colors: {
        blue: {
          50: 'rgb(var(--blue-50) / <alpha-value>)',
          400: 'rgb(var(--blue-400) / <alpha-value>)',
          500: 'rgb(var(--blue-500) / <alpha-value>)',
          600: 'rgb(var(--blue-600) / <alpha-value>)',
          700: 'rgb(var(--blue-700) / <alpha-value>)',
          800: 'rgb(var(--blue-800) / <alpha-value>)',
        },
        accent: {
          50: 'rgb(var(--blue-50) / <alpha-value>)',
          400: 'rgb(var(--blue-400) / <alpha-value>)',
          500: 'rgb(var(--blue-500) / <alpha-value>)',
          600: 'rgb(var(--blue-600) / <alpha-value>)',
          700: 'rgb(var(--blue-700) / <alpha-value>)',
          800: 'rgb(var(--blue-800) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}
