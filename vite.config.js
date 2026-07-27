import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

function stripLayerImportPlugin() {
  return {
    name: 'strip-layer-import',
    enforce: 'pre',
    transform(code, id) {
      if (id.endsWith('.css')) {
        const transformed = code.replaceAll(
          /@import\s+(['"][^'"]+['"]|url\([^)]+\))\s*layer\s*\([^)]*\)/gi,
          (match, url) => `@import ${url}`
        )
        if (transformed !== code) {
          return { code: transformed, map: null }
        }
      }
    }
  }
}

function localCheryDmsPlugin() {
  return {
    name: 'local-chery-dms-middleware',
    configureServer(server) {
      server.middlewares.stack.unshift({
        route: '',
        handle: async (req, res, next) => {
          if (req.url && (req.url.startsWith('/api/invoice_report') || req.url.startsWith('/api/chery_dms'))) {
            try {
              const urlObj = new URL(req.url, 'http://localhost');
              const query = Object.fromEntries(urlObj.searchParams.entries());

              const isInvoiceReport = req.url.startsWith('/api/invoice_report');
              const mockReq = {
                query: isInvoiceReport ? { endpoint: 'warranty-invoice-report', ...query } : query,
                headers: req.headers,
                method: req.method
              };

              const mockRes = {
                setHeader(n, v) {
                  try { res.setHeader(n, v); } catch (e) {}
                  return this;
                },
                status(code) {
                  res.statusCode = code;
                  return this;
                },
                json(data) {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(data));
                  return this;
                },
                send(data) {
                  res.end(data);
                  return this;
                }
              };

              const cheryDmsModule = await import('./api/chery_dms.js');
              const handler = cheryDmsModule.default || cheryDmsModule;
              return await handler(mockReq, mockRes);
            } catch (err) {
              console.error('Local Chery DMS Middleware Error:', err);
              return next();
            }
          }
          next();
        }
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    stripLayerImportPlugin(),
    localCheryDmsPlugin(),
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
      '/api/invoice_report': {
        target: 'http://localhost:5173',
        bypass: (req) => req.url
      },
      '/api/chery_dms': {
        target: 'http://localhost:5173',
        bypass: (req) => req.url
      },
      '/api': {
        target: 'https://www.cherymedan.web.id',
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
