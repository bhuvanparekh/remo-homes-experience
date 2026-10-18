import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * GitHub Pages serves a project site from /<repo-name>/, not from the domain
 * root. The deploy workflow passes that path in as BASE_PATH, so the repo can
 * be renamed (or moved to a custom domain, BASE_PATH=/) without touching code.
 * Locally it stays '/'.
 */
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  base,
  plugins: [react()],
  server: { open: true },
  build: {
    // three.js is ~700 kB minified and is lazy-loaded behind the stage.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three', test: /[\\/]node_modules[\\/]three[\\/]/ },
            { name: 'r3f', test: /[\\/]node_modules[\\/]@react-three[\\/]fiber[\\/]/ },
          ],
        },
      },
    },
  },
})
