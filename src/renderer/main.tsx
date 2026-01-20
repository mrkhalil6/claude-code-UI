import React from 'react';
import ReactDOM from 'react-dom/client';
import './monaco-config'; // Configure Monaco to use local files (must be before App)
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
