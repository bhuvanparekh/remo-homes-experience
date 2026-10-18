import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { applyBrandToCss } from './config/brand.config.js'
import App from './App.jsx'
import './styles/global.css'
import './styles/overlay.css'

applyBrandToCss()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
