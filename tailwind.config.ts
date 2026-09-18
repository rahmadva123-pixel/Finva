import type {Config} from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/layout/**/*.tsx',
    './src/components/ui/accordion.tsx',
    './src/components/ui/alert-dialog.tsx',
    './src/components/ui/alert.tsx',
    './src/components/ui/avatar.tsx',
    './src/components/ui/badge.tsx',
    './src/components/ui/button.tsx',
    './src/components/ui/calendar.tsx',
    './src/components/ui/card.tsx',
    './src/components/ui/carousel.tsx',
    './src/components/ui/chart.tsx',
    './src/components/ui/checkbox.tsx',
    './src/components/ui/collapsible.tsx',
    './src/components/ui/dialog.tsx',
    './src/components/ui/dropdown-menu.tsx',
    './src/components/ui/favicon-updater.tsx',
    './src/components/ui/form.tsx',
    './src/components/ui/input.tsx',
    './src/components/ui/label.tsx',
    './src/components/ui/language-switcher.tsx',
    './src/components/ui/live-chat.tsx',
    './src/components/ui/menubar.tsx',
    './src/components/ui/popover.tsx',
    './src/components/ui/progress.tsx',
    './src/components/ui/radio-group.tsx',
    './src/components/ui/scroll-area.tsx',
    './src/components/ui/select.tsx',
    './src/components/ui/separator.tsx',
    './src/components/ui/sheet.tsx',
    './src/components/ui/sidebar.tsx',
    './src/components/ui/skeleton.tsx',
    './src/components/ui/slider.tsx',
    './src/components/ui/switch.tsx',
    './src/components/ui/table.tsx',
    './src/components/ui/tabs.tsx',
    './src/components/ui/textarea.tsx',
    './src/components/ui/toast.tsx',
    './src/components/ui/toaster.tsx',
    './src/components/ui/tooltip.tsx',
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ['Inter', 'sans-serif'],
        headline: ['"Space Grotesk"', 'sans-serif'],
        code: ['monospace'],
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        chart: {
          '1': 'var(--chart-1)',
          '2': 'var(--chart-2)',
          '3': 'var(--chart-3)',
          '4': 'var(--chart-4)',
          '5': 'var(--chart-5)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar-background)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
