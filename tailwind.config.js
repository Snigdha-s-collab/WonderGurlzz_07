/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        teal: {
          950: '#051d19',
          900: '#0B3B34',
          800: '#105249',
          700: '#176b60',
          600: '#1f8577',
          500: '#14b8a6',
          400: '#2dd4bf',
          300: '#5eead4',
          200: '#99f6e4',
          100: '#ccfbf1',
          50:  '#f0fdfa',
        },
        mint: {
          300: '#6ee7b7',
          400: '#34d399',
          glow: '#38ef7d',
        },
        primary: '#00241f',
      },
      boxShadow: {
        'pill-glow':  '0 10px 25px -4px rgba(45, 212, 191, 0.40)',
        'card-glass': '0 20px 45px -12px rgba(11, 59, 52, 0.10)',
        'orb-glow':   '0 12px 32px -4px rgba(20, 184, 166, 0.45)',
      },
    },
  },
  plugins: [],
}

