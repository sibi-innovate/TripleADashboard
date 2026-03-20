/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        aia: {
          red: '#D31145',
          'red-80': '#DC3F69',
          'red-60': '#E56E8D',
          'red-40': '#ED9DB2',
          'red-20': '#F6CCD9',
          charcoal: '#333D47',
          'charcoal-60': '#848A90',
          'charcoal-20': '#D6D8DA',
          white: '#FFFFFF',
          offwhite: '#FAFAFA',
          salmon: '#FF7A85',
          orange: '#FF754D',
          yellow: '#F7C926',
          blue: '#1F78AD',
          green: '#88B943',
          'warm-grey': '#F5F0EB',
          // Legacy aliases for existing component refs
          darkRed: '#DC3F69',
          lightRed: '#E56E8D',
          gray: '#FAFAFA',
          darkGray: '#333D47',
        }
      },
      fontFamily: {
        sans: ['AIA Everest', 'Open Sans', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
