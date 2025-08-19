/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./index.tsx",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Graph-First Programming brand colors
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        
        // Node type colors for better visualization
        node: {
          port: '#ef4444',      // red-500
          adapter: '#22c55e',   // green-500
          usecase: '#3b82f6',   // blue-500
          controller: '#eab308', // yellow-500
          entity: '#a855f7',    // purple-500
        },
        
        // Layer colors
        layer: {
          domain: '#f59e0b',      // amber-500
          application: '#3b82f6', // blue-500
          infrastructure: '#22c55e', // green-500
          interface: '#a855f7',   // purple-500
        },
        
        // Status colors
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        
        // UI semantic colors
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
      },
      
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'monospace'],
      },
      
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
      
      spacing: {
        '18': '4.5rem',
        '72': '18rem',
        '84': '21rem',
        '96': '24rem',
      },
      
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'medium': '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 25px -5px rgba(0, 0, 0, 0.04)',
        'hard': '0 10px 40px -10px rgba(0, 0, 0, 0.15), 0 20px 25px -5px rgba(0, 0, 0, 0.04)',
      },
      
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      
      backdropBlur: {
        xs: '2px',
      },
      
      screens: {
        '3xl': '1600px',
      },
    },
  },
  plugins: [
    // Add useful plugins
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/container-queries'),
    
    // Custom plugin for node styles
    function({ addComponents, theme }) {
      addComponents({
        '.node-port': {
          backgroundColor: theme('colors.node.port'),
          '&:hover': {
            backgroundColor: theme('colors.red.600'),
          },
        },
        '.node-adapter': {
          backgroundColor: theme('colors.node.adapter'),
          '&:hover': {
            backgroundColor: theme('colors.green.600'),
          },
        },
        '.node-usecase': {
          backgroundColor: theme('colors.node.usecase'),
          '&:hover': {
            backgroundColor: theme('colors.blue.600'),
          },
        },
        '.node-controller': {
          backgroundColor: theme('colors.node.controller'),
          '&:hover': {
            backgroundColor: theme('colors.yellow.600'),
          },
        },
        '.node-entity': {
          backgroundColor: theme('colors.node.entity'),
          '&:hover': {
            backgroundColor: theme('colors.purple.600'),
          },
        },
        
        // Button variants
        '.btn-primary': {
          '@apply bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2': {},
        },
        '.btn-secondary': {
          '@apply bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium py-2 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2': {},
        },
        '.btn-success': {
          '@apply bg-success-600 hover:bg-success-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-success-500 focus:ring-offset-2': {},
        },
        '.btn-warning': {
          '@apply bg-warning-600 hover:bg-warning-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-warning-500 focus:ring-offset-2': {},
        },
        '.btn-error': {
          '@apply bg-error-600 hover:bg-error-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-error-500 focus:ring-offset-2': {},
        },
        
        // Card styles
        '.card': {
          '@apply bg-white rounded-xl shadow-soft border border-gray-200': {},
        },
        '.card-header': {
          '@apply px-6 py-4 border-b border-gray-200': {},
        },
        '.card-body': {
          '@apply px-6 py-4': {},
        },
        '.card-footer': {
          '@apply px-6 py-4 border-t border-gray-200': {},
        },
        
        // Input styles
        '.input-field': {
          '@apply w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors duration-200': {},
        },
        
        // Validation styles
        '.validation-error': {
          '@apply bg-error-50 border-l-4 border-error-400 p-4 rounded': {},
        },
        '.validation-warning': {
          '@apply bg-warning-50 border-l-4 border-warning-400 p-4 rounded': {},
        },
        '.validation-success': {
          '@apply bg-success-50 border-l-4 border-success-400 p-4 rounded': {},
        },
      });
    },
  ],
}