import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthRoot } from './AuthRoot';
import './styles.css';
import './reset.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><AuthRoot /></StrictMode>,
);
