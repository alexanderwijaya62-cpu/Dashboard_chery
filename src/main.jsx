import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Global fetch interceptor to append session validation headers
const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
  const urlStr = typeof url === 'string' ? url : (url?.url || '');
  let path = urlStr;
  if (urlStr.includes('://')) {
    try {
      const parsedUrl = new URL(urlStr);
      path = parsedUrl.pathname + parsedUrl.search;
    } catch (e) {}
  }

  if (
    path.startsWith('/api/') &&
    !path.startsWith('/api/login') &&
    !path.startsWith('/api/request-otp') &&
    !path.startsWith('/api/verify-otp') &&
    !path.startsWith('/api/wa-webhook') &&
    !path.startsWith('/api/kirimdev-webhook')
  ) {
    let authUsername = '';
    let authSessionId = '';
    try {
      const savedUser = localStorage.getItem('chery_auth_user');
      if (savedUser) {
        const userObj = JSON.parse(savedUser);
        authUsername = userObj.username || '';
      }
      authSessionId = localStorage.getItem('chery_session_id') || '';
    } catch (e) {
      console.warn('Failed to read auth session:', e);
    }

    if (authUsername || authSessionId) {
      if (!options.headers) {
        options.headers = {};
      }
      if (options.headers instanceof Headers) {
        options.headers.set('X-Auth-Username', authUsername);
        options.headers.set('X-Auth-Session-Id', authSessionId);
      } else if (Array.isArray(options.headers)) {
        options.headers.push(['X-Auth-Username', authUsername]);
        options.headers.push(['X-Auth-Session-Id', authSessionId]);
      } else {
        options.headers['X-Auth-Username'] = authUsername;
        options.headers['X-Auth-Session-Id'] = authSessionId;
      }
    }
  }
  return originalFetch(url, options);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

