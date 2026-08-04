import React from 'react';
import ReactDOM from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
    {/* Vercel Web Analytics — cookieless page-view/visitor counts (visitors,
        top pages, referrers). No personal data collected. Enable Web Analytics
        in the Vercel project's Analytics tab for data to appear. */}
    <Analytics />
  </React.StrictMode>
);
