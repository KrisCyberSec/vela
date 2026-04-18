import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initErrorReporting } from './errorReporting';

initErrorReporting();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
