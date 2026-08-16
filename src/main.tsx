import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppErrorBoundary } from './diagnostics/AppErrorBoundary';
import { installGlobalDiagnostics } from './diagnostics/diagnostic-log';
import './styles.css';

installGlobalDiagnostics();

const root = document.getElementById('root');

if (!root) {
  throw new Error('Application root was not found.');
}

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </StrictMode>,
);
