import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { FeedbackProvider } from './components/feedback/FeedbackProvider';
import { AppKitProvider } from './web3/AppKitProvider';
import './index.css';
import './portal/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <FeedbackProvider>
        <AppKitProvider>
          <App />
        </AppKitProvider>
      </FeedbackProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
