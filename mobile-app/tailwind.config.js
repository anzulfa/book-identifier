/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        stone:    '#120508',
        card:     '#1E0A0D',
        cream:    '#F2E4CC',
        gold:     '#C9A84C',
        burgundy: '#6B1F26',
        muted:    '#8A7060',
        border:   '#3D1A1E',
        error:    '#E05252',
      },
    },
  },
  plugins: [],
};
