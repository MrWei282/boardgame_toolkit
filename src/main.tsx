import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { useSettings } from './settings'
import { applyPalette } from './theme'

// Apply the saved colour palette before the first render so there's no flash of the
// default colours. The settings store reads localStorage synchronously on creation.
applyPalette(useSettings.getState().palette)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
