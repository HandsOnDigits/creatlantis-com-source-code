import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './lib/AuthContext.tsx'
import { testUserApi, loginAndTestUserApi, registerAlice } from './testUserApi'

;(window as any).testUserApi = testUserApi
;(window as any).loginAndTestUserApi = loginAndTestUserApi
;(window as any).registerAlice = registerAlice

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
