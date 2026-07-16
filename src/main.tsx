import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthRoot } from './AuthRoot';
import './styles.css';
import './reset.css';
import './dialogs.css';
import './live-login.css';
import './live-logo.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><AuthRoot /></StrictMode>,
);
