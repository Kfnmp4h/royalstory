import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthRoot } from './AuthRoot';
import './styles.css';
import './reset.css';
import './dialogs.css';
import './ui/tokens/royal-tokens.css';
import './ui/royal-components.css';
import './auth/royal-auth.css';
import './auth/royal-auth-target.css';
import './auth/royal-auth-illustrated.css';
import './live-login.css';
import './auth/royal-auth-layout-v2.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><AuthRoot /></StrictMode>,
);
