/** @type {import('tailwindcss').Config} */
export default {
  // Catalyst's dark: variants need the class strategy, which is also what the
  // theme toggle drives.
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
