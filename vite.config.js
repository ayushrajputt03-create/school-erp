import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // `npm run dev` sirf SPA serve karta hai — /api/* serverless routes nahi.
  // Isliye parent portal aur staff login local par toot jaate the. Ab dev server
  // /api ko `vercel dev` (port 3000) par bhej deta hai:
  //   terminal 1: npx vercel dev --listen 3000
  //   terminal 2: npm run dev
  // Vercel dev na chal raha ho to sirf /api calls fail hongi, baaki app chalega.
  // Production build par iska koi asar nahi — server config sirf dev ke liye hai.
  server: {
    proxy: {
      '/api': {
        target: process.env.DEV_API_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase')) return 'firebase'
          if (id.includes('node_modules/lucide-react')) return 'icons'
          if (id.includes('node_modules/react')) return 'react'
        },
      },
    },
  },
})
