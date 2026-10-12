/** @type {import('tailwindcss').Config} */
const v = (nombre) => `var(--${nombre})`;

module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      screens: { xs: '475px' },
      fontFamily: { sans: ['Manrope', 'system-ui', 'sans-serif'] },
      colors: {
        fondo: v('bg'),
        superficie: v('surface'),
        sub: { DEFAULT: v('sub'), 2: v('sub-2'), 3: v('sub-3') },
        tinta: { DEFAULT: v('text'), 2: v('t-2'), 3: v('t-3'), 4: v('t-4'), 5: v('t-5') },
        linea: {
          DEFAULT: v('line'), 2: v('line-2'), 3: v('line-3'), suave: v('line-soft'),
          0: v('line-0'), '00': v('line-00'), tl: v('line-tl'),
        },
        pista: { DEFAULT: v('track'), 2: v('track-2') },
        segmento: { DEFAULT: v('seg'), activo: v('seg-on') },
        acento: {
          DEFAULT: v('acc'), tinta: v('acc-ink'), hover: v('acc-hover'), 'tinta-2': v('acc-ink-2'),
          linea: v('acc-line'), suave: v('acc-soft'), tenue: v('acc-tint'), 'tenue-2': v('acc-tint-2'),
          'tenue-3': v('acc-tint-3'),
        },
        rojo: {
          DEFAULT: v('red'), 2: v('red-2'), 3: v('red-3'), linea: v('red-line'), suave: v('red-soft'), tenue: v('red-tint'),
        },
        ambar: {
          DEFAULT: v('amb'), 2: v('amb-2'), 3: v('amb-3'), linea: v('amb-line'), suave: v('amb-soft'), tenue: v('amb-tint'),
        },
        verde: { DEFAULT: v('grn'), suave: v('grn-soft') },
        barra: v('bar'),
        cabecera: v('header'),
      },
      boxShadow: {
        tarjeta: '0 1px 2px rgba(15,23,42,.04), 0 10px 24px -20px rgba(15,23,42,.35)',
        boton: '0 8px 18px -10px rgba(37,99,235,.9)',
        anillo: '0 0 0 3px rgba(37,99,235,.15)',
      },
    },
  },
  plugins: [],
};
