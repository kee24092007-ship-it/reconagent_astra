/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          900: "#0D1B2A",
          800: "#112233",
          700: "#1B2A3A",
          600: "#24364A"
        },
        mint: {
          500: "#2ECC71",
          600: "#27AE60",
          400: "#48C9B0"
        }
      }
    },
  },
  plugins: [],
}
