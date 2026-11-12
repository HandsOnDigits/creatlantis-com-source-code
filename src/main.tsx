import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './AuthContext.tsx'
import { LiveProvider } from './LiveContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <LiveProvider>
        <App />
      </LiveProvider>
    </AuthProvider>
  </StrictMode>,
)
