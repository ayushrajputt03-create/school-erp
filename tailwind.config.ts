<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./data/**/*.{js,ts,jsx,tsx,mdx}"
  ],
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
  theme: {
    extend: {
      colors: {
        brand: {
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
          50: "#eff6ff",
          100: "#dbeafe",
          600: "#2563eb",
          700: "#1d4ed8"
=======
          50: '#eff6ff',
          500: '#2563eb',
          600: '#1d4ed8'
>>>>>>> theirs
=======
          50: '#eff6ff',
          500: '#2563eb',
          600: '#1d4ed8'
>>>>>>> theirs
=======
          50: '#eff6ff',
          500: '#2563eb',
          600: '#1d4ed8'
>>>>>>> theirs
=======
          50: '#eff6ff',
          500: '#2563eb',
          600: '#1d4ed8'
>>>>>>> theirs
        }
=======
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#2563eb', soft: '#eff6ff' }
>>>>>>> theirs
      }
    }
  },
  plugins: []
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
};

export default config;
=======
} satisfies Config;
>>>>>>> theirs
=======
} satisfies Config;
>>>>>>> theirs
=======
} satisfies Config;
>>>>>>> theirs
=======
} satisfies Config;
>>>>>>> theirs
=======
};

export default config;
>>>>>>> theirs
