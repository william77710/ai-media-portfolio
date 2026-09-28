/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(40 20% 97%)',
        foreground: 'hsl(222 20% 16%)',
        card: '#fff',
        'card-foreground': 'hsl(222 20% 16%)',
        primary: 'hsl(174 72% 30%)',
        'primary-foreground': '#fff',
        secondary: 'hsl(220 15% 94%)',
        'secondary-foreground': 'hsl(174 72% 30%)',
        muted: 'hsl(220 15% 94%)',
        'muted-foreground': 'hsl(220 10% 45%)',
        accent: 'hsl(220 15% 94%)',
        'accent-foreground': 'hsl(174 72% 30%)',
        destructive: 'hsl(0 84% 60%)',
        'destructive-foreground': '#fff',
        border: 'hsl(220 10% 88%)',
        input: 'hsl(220 10% 88%)',
        ring: 'hsl(174 72% 30%)',
      },
      fontFamily: {
        sans: ['Noto Sans SC', 'system-ui', 'sans-serif'],
        serif: ['Noto Serif SC', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
