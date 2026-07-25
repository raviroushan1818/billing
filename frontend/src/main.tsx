import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './auth/AuthContext';
import { ThemeProvider } from './theme/ThemeContext';
import { DialogProvider } from './components/Dialog';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <DialogProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </DialogProvider>
    </ThemeProvider>
  </StrictMode>,
);
