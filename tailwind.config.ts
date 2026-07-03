import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: {
          background: '#f7f7ff',
          card: '#ffffff',
          border: '#e8e9f6',
          muted: '#6b7280',
          blue: '#3558e6',
          blueSoft: '#edf2ff',
          violet: '#6d5dd3',
          danger: '#e04b4b',
        },
      },
      boxShadow: {
        soft: '0 8px 24px rgba(30, 41, 59, 0.06)',
      },
      borderRadius: {
        app: '18px',
      },
    },
  },
  plugins: [],
};

export default config;
