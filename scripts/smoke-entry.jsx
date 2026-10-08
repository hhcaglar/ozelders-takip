import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import { AuthProvider } from '../src/lib/auth.jsx'
import App from '../src/App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
)
