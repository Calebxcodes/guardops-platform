import * as Sentry from '@sentry/react'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Only initialise when a DSN is provided — safe to deploy without one configured yet
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    initialScope: {
      tags: { app: 'guardops-guard' },
    },
    beforeSend(event, hint) {
      const err = hint?.originalException as any
      // Suppress expected 401s (expired JWT) — not actionable noise
      if (err?.response?.status === 401 || err?.status === 401) return null
      return event
    },
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
