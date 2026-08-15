import { defineConfig, loadEnv } from 'vite'
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
  const dmsModuleUrl = new URL('./api/chery_dms.js', import.meta.url).href;
  const csiModuleUrl = new URL('./api/csi-proxy.js', import.meta.url).href;
  const epcModuleUrl = new URL('./api/chery_epc.js', import.meta.url).href;
  const dbModuleUrl = new URL('./api/db.js', import.meta.url).href;
  let cachedDmsHandler = null;
  let cachedCsiHandler = null;

  return {
    name: 'local-chery-dms-middleware',
    configureServer(server) {
      // Muat file .env agar variabel (mis. SUPABASE_SERVICE_ROLE_KEY)
      // tersedia untuk handler /api/db pada mode development lokal.
      const env = loadEnv(server.config.mode || 'development', process.cwd(), '');
      for (const [k, v] of Object.entries(env)) {
        if (process.env[k] === undefined) process.env[k] = v;
      }
      server.middlewares.stack.unshift({
        route: '',
        handle: async (req, res, next) => {
          if (req.url && (
            req.url.startsWith('/api/invoice_report') || 
            req.url.startsWith('/api/chery_dms') || 
            req.url.startsWith('/api/csi-proxy') ||
            req.url.startsWith('/api/chery_epc') ||
            req.url.startsWith('/api/db')
          )) {
            try {
              const urlObj = new URL(req.url, 'http://localhost');
              const query = Object.fromEntries(urlObj.searchParams.entries());

              let reqBody = '';
              if (req.method === 'POST') {
                reqBody = await new Promise((resolve, reject) => {
                  let chunks = [];
                  req.on('data', chunk => chunks.push(chunk));
                  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
                  req.on('error', err => reject(err));
                });
              }

              let parsedBody = reqBody;
              if (typeof reqBody === 'string' && reqBody.trim()) {
                if (req.headers['content-type']?.includes('application/json')) {
                  try { parsedBody = JSON.parse(reqBody); } catch (e) {}
                }
              }

              const isInvoiceReport = req.url.startsWith('/api/invoice_report');
              const isCsiProxy = req.url.startsWith('/api/csi-proxy');
              const isEpcProxy = req.url.startsWith('/api/chery_epc');
              const isDbProxy = req.url.startsWith('/api/db');

              const mockReq = {
                url: req.url,
                query: isInvoiceReport ? { endpoint: 'warranty-invoice-report', ...query } : query,
                headers: req.headers,
                method: req.method,
                body: parsedBody
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

              if (isDbProxy) {
                const dbModule = await import(dbModuleUrl + '?t=' + Date.now());
                const handler = dbModule.default || dbModule;
                return await handler(mockReq, mockRes);
              } else if (isCsiProxy) {
                if (!cachedCsiHandler) {
                  const csiModule = await import(csiModuleUrl);
                  cachedCsiHandler = csiModule.default || csiModule;
                }
                return await cachedCsiHandler(mockReq, mockRes);
              } else if (isEpcProxy) {
                const epcModule = await import(epcModuleUrl + '?t=' + Date.now());
                const handler = epcModule.default || epcModule;
                return await handler(mockReq, mockRes);
              } else {
                const dmsModule = await import(dmsModuleUrl + '?t=' + Date.now());
                const handler = dmsModule.default || dmsModule;
                return await handler(mockReq, mockRes);
              }
            } catch (err) {
              console.error('Local Chery DMS Middleware Error:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Internal Middleware Error' }));
              return;
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
        target: 'http://localhost:5173',
        bypass: (req) => req.url
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
