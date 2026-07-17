/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#16a34a',
          foreground: '#ffffff',
        },
      },
    },
  },
  plugins: [],
}
