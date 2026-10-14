import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { applyTheme, loadSettings } from './app/prefs'
import './styles.css'

applyTheme(loadSettings().theme)

const container = document.getElementById('root')
if (!container) throw new Error('Root container is missing')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
