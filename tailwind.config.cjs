/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0b0d11', 900: '#0f1217', 850: '#141820', 800: '#181d26', 700: '#212733', 600: '#2b3342', 500: '#3a4457' },
        saffron: { DEFAULT: '#ff9933', 600: '#f08210', 700: '#d46f08' },
        indiagreen: '#138808',
        chakra: '#000080',
      },
      fontFamily: { ui: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif'] },
    },
  },
  plugins: [],
};
