/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  // getGridClasses() arma `md:grid-cols-${n}` en tiempo de ejecucion, y el JIT
  // de Tailwind no puede detectar clases construidas dinamicamente.
  safelist: ["md:grid-cols-2", "md:grid-cols-3", "md:grid-cols-4"],
  theme: {
    extend: {
      screens: {
        xs: "475px",
      },
    },
  },
  plugins: [],
};
