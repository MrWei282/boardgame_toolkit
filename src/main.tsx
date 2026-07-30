import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { applyLang, useSettings } from './settings'
import { applyTheme } from './theme'

// Apply saved colour theme + language before the first render (no flash / correct
// <html lang>). The settings store reads localStorage synchronously on creation.
{
  const s = useSettings.getState()
  applyTheme(s.palette, s.customColors)
  applyLang(s.language)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
