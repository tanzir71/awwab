
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
  
  // Check for service worker updates
  setInterval(() => {
    navigator.serviceWorker.getRegistration().then(registration => {
      if (registration) registration.update();
    });
  }, 60 * 60 * 1000); // Check for updates every hour
}

createRoot(document.getElementById("root")!).render(<App />);
