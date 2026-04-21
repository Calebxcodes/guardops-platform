/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#1e3a8a', light: '#3b5fc0', dark: '#172d6e' },
      },
    },
  },
  plugins: [],
}
