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
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
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
