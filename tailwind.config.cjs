/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './client/index.html',
    './client/src/**/*.{html,js,ts,jsx,tsx,css}',
    './client/src/**/**',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: 'var(--surface)',
        'on-surface': 'var(--on-surface)',
        'on-surface-variant': 'var(--on-surface-variant)',
        'surface-container': 'var(--surface-container)',
        'surface-container-low': 'var(--surface-container-low)',
        'surface-container-lowest': 'var(--surface-container-lowest)',
        'outline-variant': 'var(--outline-variant)',
        primary: 'var(--primary)',
        'primary-foreground': 'var(--primary-foreground)',
        accent: 'var(--accent)',
        'accent-foreground': 'var(--accent-foreground)',
        'accent-container': 'var(--accent-container)',
        destructive: 'var(--destructive)',
        'destructive-container': 'var(--destructive-container)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)'
      }
    }
  },
  safelist: [
    'border-accent-container',
    'bg-accent-container',
    'text-accent',
    'border-outline-variant',
    'bg-surface',
    'text-on-surface',
  ],
  plugins: []
}
