
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TvDisplay } from './components/TvDisplay';
import { isDisplayPage } from './utils/castDisplay';
import { primeAlertAudio } from './utils/alertSounds';
import { installOfflineGuard } from './utils/offlineMode';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

primeAlertAudio();
installOfflineGuard();
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      {isDisplayPage() ? <TvDisplay /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>
);

if ('serviceWorker' in navigator && location.protocol === 'https:' && location.hostname !== 'localhost') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
