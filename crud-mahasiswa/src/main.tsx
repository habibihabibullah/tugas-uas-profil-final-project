import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker for PWA (Only in production to prevent dev environment hijacking)
const isDev = 
  import.meta.env.DEV || 
  (window as any).location.hostname.includes('localhost') || 
  (window as any).location.hostname.includes('127.0.0.1') || 
  (window as any).location.hostname.includes('ais-dev-') || 
  (window as any).location.hostname.includes('run.app'); // Treat AI Studio dev/pre run apps as dev environments for SW cache safety

if ('serviceWorker' in navigator) {
  if (isDev) {
    // Aggressively unregister any service worker in preview/dev mode to bypass stale caching
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      if (registrations.length > 0) {
        console.log('Stale Service Worker(s) detected. Cleaning up for development...', registrations);
        Promise.all(registrations.map(r => r.unregister())).then(() => {
          if ('caches' in window) {
            caches.keys().then((keys) => {
              Promise.all(keys.map(key => caches.delete(key))).then(() => {
                console.log('Caches cleared. Reloading with fresh code...');
                (window as any).location.reload();
              });
            });
          } else {
            (window as any).location.reload();
          }
        });
      }
    });
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('Service Worker registered successfully:', reg.scope);
        })
        .catch((err) => {
          console.error('Service Worker registration failed:', err);
        });
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
