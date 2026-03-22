/**
 * Agricultural Theme System
 * Multiple aesthetic themes for the Ag-Extension Dashboard
 */

export type ThemeName = 'forest' | 'golden' | 'terracotta' | 'oceanic' | 'sunset' | 'sage' | 'cyber';

export interface ThemeColors {
    primary: {
        50: string;
        100: string;
        200: string;
        300: string;
        400: string;
        500: string;
        600: string;
        700: string;
        800: string;
        900: string;
    };
    secondary: {
        50: string;
        100: string;
        200: string;
        300: string;
        400: string;
        500: string;
        600: string;
        700: string;
        800: string;
        900: string;
    };
    accent: {
        50: string;
        100: string;
        200: string;
        300: string;
        400: string;
        500: string;
        600: string;
        700: string;
        800: string;
        900: string;
    };
    background: {
        primary: string;
        secondary: string;
        card: string;
    };
}

export const themes: Record<ThemeName, ThemeColors> = {
    /**
     * Forest Theme - Rich greens representing lush crops and forests
     * Best for: East Africa, Rainforest regions
     */
    forest: {
        primary: {
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
        secondary: {
            50: '#ecfeff',
            100: '#cffafe',
            200: '#a5f3fc',
            300: '#67e8f9',
            400: '#22d3ee',
            500: '#06b6d4',
            600: '#0891b2',
            700: '#0e7490',
            800: '#155e75',
            900: '#164e63',
        },
        accent: {
            50: '#fefce8',
            100: '#fef9c3',
            200: '#fef08a',
            300: '#fde047',
            400: '#facc15',
            500: '#eab308',
            600: '#ca8a04',
            700: '#a16207',
            800: '#854d0e',
            900: '#713f12',
        },
        background: {
            primary: '#f0fdf4',
            secondary: '#dcfce7',
            card: '#ffffff',
        },
    },

    /**
     * Golden Harvest Theme - Warm amber/gold representing wheat fields and harvest
     * Best for: Savanna regions, grain farming areas
     */
    golden: {
        primary: {
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
        secondary: {
            50: '#fdf4ff',
            100: '#fae8ff',
            200: '#f5d0fe',
            300: '#f0abfc',
            400: '#e879f9',
            500: '#d946ef',
            600: '#c026d3',
            700: '#a21caf',
            800: '#86198f',
            900: '#701a75',
        },
        accent: {
            50: '#ecfdf5',
            100: '#d1fae5',
            200: '#a7f3d0',
            300: '#6ee7b7',
            400: '#34d399',
            500: '#10b981',
            600: '#059669',
            700: '#047857',
            800: '#065f46',
            900: '#064e3b',
        },
        background: {
            primary: '#fffbeb',
            secondary: '#fef3c7',
            card: '#ffffff',
        },
    },

    /**
     * Terracotta Theme - Earthy reds and oranges representing soil and clay
     * Best for: Semi-arid regions, soil-focused farming
     */
    terracotta: {
        primary: {
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
        secondary: {
            50: '#fff7ed',
            100: '#ffedd5',
            200: '#fed7aa',
            300: '#fdba74',
            400: '#fb923c',
            500: '#f97316',
            600: '#ea580c',
            700: '#c2410c',
            800: '#9a3412',
            900: '#7c2d12',
        },
        accent: {
            50: '#faf5ff',
            100: '#f3e8ff',
            200: '#e9d5ff',
            300: '#d8b4fe',
            400: '#c084fc',
            500: '#a855f7',
            600: '#9333ea',
            700: '#7e22ce',
            800: '#6b21a8',
            900: '#581c87',
        },
        background: {
            primary: '#fef2f2',
            secondary: '#fee2e2',
            card: '#ffffff',
        },
    },

    /**
     * Oceanic Theme - Blues representing water, irrigation, and coastal farming
     * Best for: Coastal regions, rice farming, irrigation systems
     */
    oceanic: {
        primary: {
            50: '#eff6ff',
            100: '#dbeafe',
            200: '#bfdbfe',
            300: '#93c5fd',
            400: '#60a5fa',
            500: '#3b82f6',
            600: '#2563eb',
            700: '#1d4ed8',
            800: '#1e40af',
            900: '#1e3a8a',
        },
        secondary: {
            50: '#f0fdfa',
            100: '#ccfbf1',
            200: '#99f6e4',
            300: '#5eead4',
            400: '#2dd4bf',
            500: '#14b8a6',
            600: '#0d9488',
            700: '#0f766e',
            800: '#115e59',
            900: '#134e4a',
        },
        accent: {
            50: '#fff7ed',
            100: '#ffedd5',
            200: '#fed7aa',
            300: '#fdba74',
            400: '#fb923c',
            500: '#f97316',
            600: '#ea580c',
            700: '#c2410c',
            800: '#9a3412',
            900: '#7c2d12',
        },
        background: {
            primary: '#eff6ff',
            secondary: '#dbeafe',
            card: '#ffffff',
        },
    },

    /**
     * Sunset Theme - Warm gradients representing evening harvest and twilight
     * Best for: General purpose, appealing to all demographics
     */
    sunset: {
        primary: {
            50: '#fff7ed',
            100: '#ffedd5',
            200: '#fed7aa',
            300: '#fdba74',
            400: '#fb923c',
            500: '#f97316',
            600: '#ea580c',
            700: '#c2410c',
            800: '#9a3412',
            900: '#7c2d12',
        },
        secondary: {
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
        accent: {
            50: '#fefce8',
            100: '#fef9c3',
            200: '#fef08a',
            300: '#fde047',
            400: '#facc15',
            500: '#eab308',
            600: '#ca8a04',
            700: '#a16207',
            800: '#854d0e',
            900: '#713f12',
        },
        background: {
            primary: '#fff7ed',
            secondary: '#ffedd5',
            card: '#ffffff',
        },
    },

    /**
     * Sage Theme - Muted greens representing herbs, vegetables, and organic farming
     * Best for: Vegetable farming, organic agriculture, greenhouse operations
     */
    sage: {
        primary: {
            50: '#f6fcf5',
            100: '#eef7ed',
            200: '#d8edd6',
            300: '#b8deb8',
            400: '#8eca93',
            500: '#6bb872',
            600: '#4d9654',
            700: '#3d7543',
            800: '#335e38',
            900: '#2a4d30',
        },
        secondary: {
            50: '#fdf4ff',
            100: '#fae8ff',
            200: '#f5d0fe',
            300: '#f0abfc',
            400: '#e879f9',
            500: '#d946ef',
            600: '#c026d3',
            700: '#a21caf',
            800: '#86198f',
            900: '#701a75',
        },
        accent: {
            50: '#fff7ed',
            100: '#ffedd5',
            200: '#fed7aa',
            300: '#fdba74',
            400: '#fb923c',
            500: '#f97316',
            600: '#ea580c',
            700: '#c2410c',
            800: '#9a3412',
            900: '#7c2d12',
        },
        background: {
            primary: '#f6fcf5',
            secondary: '#eef7ed',
            card: '#ffffff',
        },
    },

    /**
     * Cyber Theme - Futuristic dark interface with neon accents
     * Best for: High-tech precision agriculture, IoT dashboards, night operations
     */
    cyber: {
        primary: {
            50: '#e0ffff',
            100: '#b3ffff',
            200: '#80ffff',
            300: '#4dffff',
            400: '#1affff',
            500: '#00ffff',
            600: '#00cccc',
            700: '#009999',
            800: '#006666',
            900: '#003333',
        },
        secondary: {
            50: '#ffe0f0',
            100: '#ffb3d9',
            200: '#ff80c0',
            300: '#ff4da6',
            400: '#ff1a8c',
            500: '#ff00ff',
            600: '#cc00cc',
            700: '#990099',
            800: '#660066',
            900: '#330033',
        },
        accent: {
            50: '#e0e0ff',
            100: '#b3b3ff',
            200: '#8080ff',
            300: '#4d4dff',
            400: '#1a1aff',
            500: '#0000ff',
            600: '#0000cc',
            700: '#000099',
            800: '#000066',
            900: '#000033',
        },
        background: {
            primary: '#010101',
            secondary: '#0a0a0a',
            card: '#121212',
        },
    },
};

/**
 * Helper to convert hex to RGB space-separated values for Tailwind opacity support
 */
function hexToRgb(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r} ${g} ${b}`;
}

/**
 * Get CSS variables for a theme
 */
export function getThemeCSS(themeName: ThemeName): string {
    const theme = themes[themeName];
    const vars: string[] = [];

    // Primary
    Object.entries(theme.primary).forEach(([key, val]) => {
        vars.push(`--color-primary-${key}: ${val};`);
        vars.push(`--color-primary-${key}-rgb: ${hexToRgb(val)};`);
    });

    // Secondary
    Object.entries(theme.secondary).forEach(([key, val]) => {
        vars.push(`--color-secondary-${key}: ${val};`);
        vars.push(`--color-secondary-${key}-rgb: ${hexToRgb(val)};`);
    });

    // Accent
    Object.entries(theme.accent).forEach(([key, val]) => {
        vars.push(`--color-accent-${key}: ${val};`);
        vars.push(`--color-accent-${key}-rgb: ${hexToRgb(val)};`);
    });

    // Backgrounds
    vars.push(`--color-bg-primary: ${theme.background.primary};`);
    vars.push(`--color-bg-secondary: ${theme.background.secondary};`);
    vars.push(`--color-bg-card: ${theme.background.card};`);

    vars.push(`--color-bg-primary-rgb: ${hexToRgb(theme.background.primary)};`);
    vars.push(`--color-bg-secondary-rgb: ${hexToRgb(theme.background.secondary)};`);
    vars.push(`--color-bg-card-rgb: ${hexToRgb(theme.background.card)};`);

    return vars.join('\n');
}

export const themeDescriptions: Record<ThemeName, string> = {
    forest: '🌲 Forest Green - Lush crops and rainforests',
    golden: '🌾 Golden Harvest - Wheat fields and grain',
    terracotta: '🏺 Terracotta - Earthy soil and clay',
    oceanic: '🌊 Oceanic Blue - Water and irrigation',
    sunset: '🌅 Sunset Orange - Warm harvest twilight',
    sage: '🌿 Sage Green - Vegetables and organic',
    cyber: '⚡ Cyber Theme - Futuristic dark neon interface',
};

/**
 * Apply theme CSS variables to the document
 */
export function applyTheme(themeName: ThemeName): void {
    const css = getThemeCSS(themeName);

    // Get or create the theme style element
    let styleElement = document.getElementById('theme-css-vars');
    if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = 'theme-css-vars';
        document.head.appendChild(styleElement);
    }

    // Force dark mode for Cyber theme
    if (themeName === 'cyber') {
        document.documentElement.classList.add('dark');
        document.body.classList.add('theme-cyber');
    } else {
        // If user prefers light mode (or no preference), keep it light unless manually switched
        // But typically 'applyTheme' is called on init, so we might want to default to dark if system prefers
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        document.body.classList.remove('theme-cyber');
    }

    // Create dark mode versions of the theme colors (inverted for dark backgrounds)
    const darkVars: string[] = [];
    const theme = themes[themeName];

    // For dark mode, we use darker versions of primary/secondary colors
    // and darker backgrounds
    Object.entries(theme.primary).forEach(([key, val]) => {
        // Use a darker shade for dark mode
        const darkVal = key === '50' ? '#111827' :
            key === '100' ? '#1f2937' :
                key === '200' ? '#374151' :
                    key === '300' ? '#4b5563' :
                        key === '400' ? '#6b7280' :
                            val; // 500+ stay same
        darkVars.push(`--color-primary-${key}: ${darkVal};`);
        darkVars.push(`--color-primary-${key}-rgb: ${hexToRgb(darkVal)};`);
    });

    Object.entries(theme.secondary).forEach(([key, val]) => {
        darkVars.push(`--color-secondary-${key}: ${val};`);
        darkVars.push(`--color-secondary-${key}-rgb: ${hexToRgb(val)};`);
    });

    Object.entries(theme.accent).forEach(([key, val]) => {
        darkVars.push(`--color-accent-${key}: ${val};`);
        darkVars.push(`--color-accent-${key}-rgb: ${hexToRgb(val)};`);
    });

    // Dark mode backgrounds
    if (themeName === 'cyber') {
        // Cyber theme dark mode - enhanced neon effects
        darkVars.push(`--color-bg-primary: #010101;`);
        darkVars.push(`--color-bg-secondary: #050505;`);
        darkVars.push(`--color-bg-card: #0a0a0a;`);
        darkVars.push(`--color-bg-primary-rgb: 1 1 1;`);
        darkVars.push(`--color-bg-secondary-rgb: 5 5 5;`);
        darkVars.push(`--color-bg-card-rgb: 10 10 10;`);

        // Glassmorphism variables for premium feel
        darkVars.push(`--glass-bg: rgba(10, 10, 10, 0.6);`);
        darkVars.push(`--glass-border: rgba(79, 209, 197, 0.2);`);
        darkVars.push(`--glass-blur: 16px;`);

        // Cyber specific overrides for darker/brighter neon
        darkVars.push(`--color-primary-50: #000000;`);
        darkVars.push(`--color-primary-100: #050505;`);
        darkVars.push(`--color-primary-200: #0a0a0a;`);
        darkVars.push(`--color-primary-300: #0f0f0f;`);
        darkVars.push(`--color-primary-400: #141414;`);
    } else {
        darkVars.push(`--color-bg-primary: #111827;`);
        darkVars.push(`--color-bg-secondary: #1f2937;`);
        darkVars.push(`--color-bg-card: #374151;`);
        darkVars.push(`--color-bg-primary-rgb: 17 24 39;`);
        darkVars.push(`--color-bg-secondary-rgb: 31 41 55;`);
        darkVars.push(`--color-bg-card-rgb: 55 65 81;`);
    }

    styleElement.textContent = `:root {\n${css}\n}\n.dark {\n${darkVars.join('\n')}\n}`;
}

/**
 * Initialize theme from localStorage or default
 */
export function initializeTheme(): void {
    const savedTheme = localStorage.getItem('ag-theme-name') as ThemeName | null;
    const theme = savedTheme && themes[savedTheme] ? savedTheme : 'forest';
    applyTheme(theme);
}
