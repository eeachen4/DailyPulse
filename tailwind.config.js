/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/web/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 纸色底 · 近黑墨 · 暖灰 · 细线 · 脉冲朱红
        paper: '#FAF8F3',
        cream: '#F1EDE4',
        ink: '#17150F',
        muted: '#6E675A',
        line: '#E3DDCE',
        accent: { DEFAULT: '#E8542E', dark: '#C5451F', soft: '#F7E3DB' },
      },
      fontFamily: {
        sans: ['Sora', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
