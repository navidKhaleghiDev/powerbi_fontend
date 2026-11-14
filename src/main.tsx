import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { router } from '@/app/router';
import '@/global.css';
import '@/dark-theme.css';

const root = document.getElementById('root');

if (!root) throw new Error('Missing application root the application html file should be prvided');

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
