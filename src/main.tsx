import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { useSettings } from './settings'
import { applyTheme } from './theme'

// Apply the saved colour theme before the first render so there's no flash of the
// default colours. The settings store reads localStorage synchronously on creation.
{
  const s = useSettings.getState()
  applyTheme(s.palette, s.customColors)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
