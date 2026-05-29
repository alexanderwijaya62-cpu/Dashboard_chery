import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['defaults', 'not IE 11', 'Chrome >= 49', 'Samsung >= 5'],
    })
  ],
  test: {
    globals: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://cherymedan.web.id',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-utils': ['date-fns', 'xlsx', 'toastify-js'],
          'vendor-icons': ['lucide-react'],
          'vendor-others': ['qrcode.react', 'telegram']
        }
      }
    }
  }
})
