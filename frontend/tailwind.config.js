/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Heebo', 'sans-serif'],
      },
      colors: {
        pitch: {
          900: '#0a1a0f',
          800: '#0f2416',
          700: '#163020',
        },
      },
    },
  },
  plugins: [],
}
