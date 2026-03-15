/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: 'rgb(var(--color-primary-50-rgb) / <alpha-value>)',
                    100: 'rgb(var(--color-primary-100-rgb) / <alpha-value>)',
                    200: 'rgb(var(--color-primary-200-rgb) / <alpha-value>)',
                    300: 'rgb(var(--color-primary-300-rgb) / <alpha-value>)',
                    400: 'rgb(var(--color-primary-400-rgb) / <alpha-value>)',
                    500: 'rgb(var(--color-primary-500-rgb) / <alpha-value>)',
                    600: 'rgb(var(--color-primary-600-rgb) / <alpha-value>)',
                    700: 'rgb(var(--color-primary-700-rgb) / <alpha-value>)',
                    800: 'rgb(var(--color-primary-800-rgb) / <alpha-value>)',
                    900: 'rgb(var(--color-primary-900-rgb) / <alpha-value>)',
                },
                secondary: {
                    50: 'rgb(var(--color-secondary-50-rgb) / <alpha-value>)',
                    100: 'rgb(var(--color-secondary-100-rgb) / <alpha-value>)',
                    200: 'rgb(var(--color-secondary-200-rgb) / <alpha-value>)',
                    300: 'rgb(var(--color-secondary-300-rgb) / <alpha-value>)',
                    400: 'rgb(var(--color-secondary-400-rgb) / <alpha-value>)',
                    500: 'rgb(var(--color-secondary-500-rgb) / <alpha-value>)',
                    600: 'rgb(var(--color-secondary-600-rgb) / <alpha-value>)',
                    700: 'rgb(var(--color-secondary-700-rgb) / <alpha-value>)',
                    800: 'rgb(var(--color-secondary-800-rgb) / <alpha-value>)',
                    900: 'rgb(var(--color-secondary-900-rgb) / <alpha-value>)',
                },
                accent: {
                    50: 'rgb(var(--color-accent-50-rgb) / <alpha-value>)',
                    100: 'rgb(var(--color-accent-100-rgb) / <alpha-value>)',
                    200: 'rgb(var(--color-accent-200-rgb) / <alpha-value>)',
                    300: 'rgb(var(--color-accent-300-rgb) / <alpha-value>)',
                    400: 'rgb(var(--color-accent-400-rgb) / <alpha-value>)',
                    500: 'rgb(var(--color-accent-500-rgb) / <alpha-value>)',
                    600: 'rgb(var(--color-accent-600-rgb) / <alpha-value>)',
                    700: 'rgb(var(--color-accent-700-rgb) / <alpha-value>)',
                    800: 'rgb(var(--color-accent-800-rgb) / <alpha-value>)',
                    900: 'rgb(var(--color-accent-900-rgb) / <alpha-value>)',
                },
                error: {
                    50: 'rgb(var(--color-error-50-rgb) / <alpha-value>)',
                    100: 'rgb(var(--color-error-100-rgb) / <alpha-value>)',
                    200: 'rgb(var(--color-error-200-rgb) / <alpha-value>)',
                    300: 'rgb(var(--color-error-300-rgb) / <alpha-value>)',
                    400: 'rgb(var(--color-error-400-rgb) / <alpha-value>)',
                    500: 'rgb(var(--color-error-500-rgb) / <alpha-value>)',
                    600: 'rgb(var(--color-error-600-rgb) / <alpha-value>)',
                    700: 'rgb(var(--color-error-700-rgb) / <alpha-value>)',
                    800: 'rgb(var(--color-error-800-rgb) / <alpha-value>)',
                    900: 'rgb(var(--color-error-900-rgb) / <alpha-value>)',
                },
                'theme-bg': {
                    primary: 'rgb(var(--color-bg-primary-rgb) / <alpha-value>)',
                    secondary: 'rgb(var(--color-bg-secondary-rgb) / <alpha-value>)',
                    card: 'rgb(var(--color-bg-card-rgb) / <alpha-value>)',
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-out',
                'slide-up': 'slideUp 0.5s ease-out',
                'slide-in-right': 'slideInRight 0.3s ease-out',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                slideInRight: {
                    '0%': { transform: 'translateX(100%)', opacity: '0' },
                    '100%': { transform: 'translateX(0)', opacity: '1' },
                },
            },
        },
    },
    plugins: [],
};
