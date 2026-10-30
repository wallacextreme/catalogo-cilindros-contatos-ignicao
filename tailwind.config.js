/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,js,html}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        industrial: {
          blue: "#1d4ed8",
          emerald: "#059669",
          amber: "#d97706",
          dark: "#0f172a",
          darker: "#020617",
          cardDark: "#1e293b",
          borderDark: "#334155"
        }
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "Courier New", "monospace"]
      }
    },
  },
  plugins: [],
}
