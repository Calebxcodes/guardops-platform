import * as Sentry from '@sentry/node'

// Only initialise when a DSN is provided — safe to deploy without one configured yet
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    // Capture 10% of transactions for performance monitoring
    tracesSampleRate: 0.1,
    // Tag every event with the Railway deployment info when available
    initialScope: {
      tags: {
        service: 'guardops-backend',
        ...(process.env.RAILWAY_DEPLOYMENT_ID && {
          deployment: process.env.RAILWAY_DEPLOYMENT_ID,
        }),
      },
    },
  })
}
