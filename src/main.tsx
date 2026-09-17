import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Prevent scroll wheel / trackpad scroll from accidentally modifying values on focused number inputs
document.addEventListener('wheel', (e) => {
  if (
    document.activeElement instanceof HTMLInputElement &&
    document.activeElement.type === 'number'
  ) {
    document.activeElement.blur();
  }
}, { passive: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

