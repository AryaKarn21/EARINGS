/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",
        primaryDark: "var(--color-primary-dark)",
        primaryLight: "var(--color-primary-light)",
        background: "var(--color-background)",
        surface: "var(--color-surface)",
        textPrimary: "var(--color-text-primary)",
        textSecondary: "var(--color-text-secondary)",
        border: "var(--color-border)",
        success: "var(--color-success)",
        successLight: "var(--color-success-light)",
        danger: "var(--color-danger)",
        dangerLight: "var(--color-danger-light)",
        ink: "var(--color-ink)",
        inkSoft: "var(--color-ink-soft)",
      },
    },
  },
  plugins: [],
}
