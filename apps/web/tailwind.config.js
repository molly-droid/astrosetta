/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        label: ['var(--font-label)'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        gold: {
          primary: '#D4AF85',
          accent: '#C9A961',
        },
        celestial: {
          cyan: '#A8D4D9',
          blue: '#9DB4C8',
          purple: '#B8A5C8',
          pink: '#D8B4C2',
          green: '#A8C8A8',
        },
        paper: '#141e33',
        cream: '#FDFBF7',
        'deep-blue': '#2C3E50',
        brass: '#C4A882',
        velvet: '#0C0E1A',
        'velvet-surface': '#14172B',
        'velvet-card': '#1A1D36',
        starlight: '#F4EFE6',
        'starlight-muted': '#A0A5BD',
        'gold-foil': '#D4AF37',
        'gold-hairline': 'rgba(212,175,55,0.2)',
        'gold-muted': 'rgba(212,175,55,0.15)',
        'danger-red': '#E55B5B',
        copper: '#6B4423',
        bronze: '#8B7B6B',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))'
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))'
        }
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'slide-in-right': { from: { transform: 'translateX(100%)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
        'slide-out-left': { from: { transform: 'translateX(0)', opacity: '1' }, to: { transform: 'translateX(-100%)', opacity: '0' } },
        'fade-up': { from: { transform: 'translateY(16px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        'shimmer': { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
        'marquee': { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'slide-in-right': 'slide-in-right 0.35s cubic-bezier(0.22,1,0.36,1)',
        'slide-out-left': 'slide-out-left 0.35s cubic-bezier(0.22,1,0.36,1)',
        'fade-up': 'fade-up 0.4s cubic-bezier(0.22,1,0.36,1)',
        'shimmer': 'shimmer 2s linear infinite',
        'marquee': 'marquee 40s linear infinite',
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
}
