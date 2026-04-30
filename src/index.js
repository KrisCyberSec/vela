import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './ErrorBoundary';
import { initErrorReporting } from './errorReporting';
import { initTheme } from './theme';

// Theme must apply before React mounts to avoid a flash of wrong theme
initTheme();
initErrorReporting();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
