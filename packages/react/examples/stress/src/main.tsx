import { createRoot } from 'react-dom/client'
import '@ganttkit/react/styles.css'
import { App } from './App'

// No <StrictMode> here on purpose: its double-invoked effects would build the
// engine twice per run and skew the mount timing this page measures.
createRoot(document.getElementById('app')!).render(<App />)
