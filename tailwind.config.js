// ========================================
// tailwind.config.js - Tailwind CSS Configuration
// ========================================
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#e0eafe',
          200: '#c8dbfd',
          300: '#a6c1fa',
          400: '#839df5',
          500: '#667eea',
          600: '#5c6ce6',
          700: '#4f4fd4',
          800: '#4040aa',
          900: '#373787'
        },
        graph: {
          port: '#ff9999',
          adapter: '#99ff99',
          usecase: '#9999ff',
          controller: '#ffcc99',
          entity: '#ff99ff'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Monaco', 'Consolas', 'monospace']
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography')
  ],
}