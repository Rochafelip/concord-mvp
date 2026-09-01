import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App.tsx';
import { ApiError } from './services/apiClient';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 401 means the token is missing/invalid/expired (apiClient already logs the user
      // out in that case) — retrying is pointless and just delays the redirect to /login.
      // Any other error keeps the default retry-3x behavior.
      retry: (failureCount, error) =>
        error instanceof ApiError && error.status === 401 ? false : failureCount < 3,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
