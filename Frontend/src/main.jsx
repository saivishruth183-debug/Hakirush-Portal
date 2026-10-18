import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AuthContext from './context/authContext.jsx'
import { SidebarProvider } from './context/sidebarContext.jsx'

createRoot(document.getElementById('root')).render(
  <AuthContext>
    <SidebarProvider>
      <App />
    </SidebarProvider>
  </AuthContext>,
)
