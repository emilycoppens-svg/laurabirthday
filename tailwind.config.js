/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Manrope"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Unbounded"', '"Manrope"', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: "hsl(var(--primary))",
      },
    },
  },
  plugins: [],
};
