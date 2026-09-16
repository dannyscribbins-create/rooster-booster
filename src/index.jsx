import React from 'react';
import ReactDOM from 'react-dom/client';
// ⚠ `./index.css` WAS IMPORTED HERE AND IS GONE (Palette-16). It was a CRA
// leftover and a standing violation of CLAUDE.md's "All styling inline. Never
// add CSS files." Its four live declarations are applied imperatively below, at
// the same point in startup the stylesheet used to land; see that module for
// what was kept, what was dropped as dead, and why the system stack is
// reproduced here rather than improved.
import { applyBodyDefaults } from './utils/bodyDefaults';
import App from './App';
import reportWebVitals from './reportWebVitals';
import ErrorBoundary from './components/shared/ErrorBoundary';

applyBodyDefaults();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
