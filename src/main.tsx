import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthRoot } from './AuthRoot';
import './styles.css';
import './reset.css';
import './dialogs.css';
import './ui/tokens/royal-tokens.css';
import './ui/royal-components.css';
import './auth/royal-auth.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><AuthRoot /></StrictMode>,
);
