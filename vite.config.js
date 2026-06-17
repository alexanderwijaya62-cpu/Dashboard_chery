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
      '/api/dhl_tracking': {
        target: 'https://www.dhl.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/dhl_tracking/, '/utapi'),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
            proxyReq.setHeader('Accept', 'application/json, text/plain, */*');
            proxyReq.setHeader('Accept-Language', 'en-US,en;q=0.9,id;q=0.8');
            proxyReq.setHeader('Referer', 'https://www.dhl.com/id-en/home/tracking.html');
            proxyReq.setHeader('Origin', 'https://www.dhl.com');
          });
        }
      },
      '/api/csi-proxy': {
        target: 'http://localhost:3099',
        changeOrigin: true,
      },
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
