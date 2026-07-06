import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// apply saved theme before first paint
document.documentElement.setAttribute('data-theme', localStorage.getItem('hub_theme') || 'light')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
