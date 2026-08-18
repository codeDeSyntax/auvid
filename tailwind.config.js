/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#323232",
        background: "#1d1d1d",
        surface: "#323232",
        text: "#ececec", // ChatGPT primary text
        muted: "#8e8ea0", // ChatGPT secondary/muted text
        border: "#454545",
        accent: "var(--accent)", // dynamic accent – set by Theme provider
        // Override warm zinc shades → ChatGPT cool neutrals (affects all dark:bg-zinc-* classes)
        appDark: {
          base: "#1d1d1d",
          surface: "#323232",
          border: "#454545",
        },
        zinc: {
          50: "#fafaf9",
          100: "#f5f5f4",
          200: "#e7e5e4",
          300: "#d6d3d1",
          400: "#a8a29e",
          500: "#737373",
          600: "#525252",
          700: "#454545",
          800: "#323232",
          900: "#1d1d1d",
          950: "#1d1d1d",
        },
        zinc: {
          50: "#fafaf9",
          100: "#f5f5f4",
          200: "#e7e5e4",
          300: "#d6d3d1",
          400: "#a8a29e",
          500: "#78716c",
          600: "#57534e",
          700: "#454545",
          800: "#323232",
          900: "#1d1d1d",
          950: "#1d1d1d",
        },
      },
      fontFamily: {
        outfit: ['"Outfit"', "ui-sans-serif", "sans-serif"],
        dscript: ['"Dancing Script"', "ui-sans-serif", "sans-serif"],
        cooper: ['"Cooper Black"', "sans-serif"],
        archivo: ['"Archivo Black"', "sans-serif"],
        zilla: ['"Zilla Slab"', "Palatino"],
      },
    },
  },
  corePlugins: {
    preflight: false,
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        ".no-scrollbar": {
          "-ms-overflow-style": "none", // IE and Edge
          "scrollbar-width": "none", // Firefox
        },
        ".no-scrollbar::-webkit-scrollbar": {
          display: "none", // Chrome, Safari, Opera
        },
        ".thin-scrollbar": {
          "scrollbar-width": "thin",
          "&::-webkit-scrollbar": {
            width: "6px", // Adjust width as needed
          },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: "#5ECFFF", // Optional: Customize the scrollbar color
          },
        },
      });
    },
  ],
};
