/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ocean: {
          50: '#eef9ff',
          100: '#d9f0ff',
          500: '#1b8fe6',
          600: '#086fc4',
          700: '#075aa0',
        },
        coral: '#ff7a59',
        kelp: '#12a782',
        ink: '#172033',
      },
      boxShadow: {
        soft: '0 18px 55px rgba(23, 32, 51, 0.10)',
        node: '0 16px 36px rgba(8, 111, 196, 0.18)',
      },
    },
  },
  plugins: [],
}
