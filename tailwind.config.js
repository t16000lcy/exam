/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Noto Sans TC', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#17211d',
        sea: '#0f766e',
        leaf: '#5d7c37',
        paper: '#f7f8f4',
      },
    },
  },
  plugins: [],
};
