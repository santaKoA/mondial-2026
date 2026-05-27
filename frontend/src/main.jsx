import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-center"
          toastOptions={{
            style: { background: '#1a2e1f', color: '#fff', border: '1px solid #22c55e33', fontFamily: 'Heebo' },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
