import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppKitProvider } from './web3/AppKitProvider';
import './index.css';
import './portal/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppKitProvider>
      <App />
    </AppKitProvider>
  </React.StrictMode>
);
