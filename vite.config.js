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
    // three.js (~750 kB) and MapLibre (~1 MB) are both lazy-loaded.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three', test: /[\\/]node_modules[\\/]three[\\/]/ },
            { name: 'r3f', test: /[\\/]node_modules[\\/]@react-three[\\/]fiber[\\/]/ },
            // The Zone Lab map (~1 MB), downloaded only when Zone Lab opens.
            { name: 'maplibre', test: /[\\/]node_modules[\\/]maplibre-gl[\\/]/ },
          ],
        },
      },
    },
  },
})
