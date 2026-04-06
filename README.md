# Strondis — Operations Platform

A full-stack SaaS platform for small UK security businesses.
Three apps, one backend, deployable in under 10 minutes.

## Architecture

```
strondis/
├── backend/      Express + SQLite — deployed on Railway
├── frontend/     Admin CRM — deployed on Vercel
└── guard-app/    Officer mobile app — deployed on Vercel
```

## Quick Start (Local Dev)

```bash
npm install
npm run dev          # All three apps simultaneously
npm run dev:crm      # Backend + CRM only
npm run dev:guard    # Backend + Guard app only
```

## Environment Variables

### Backend (Railway)
```
PORT=3001
JWT_SECRET=your-secret-key-change-this
ANTHROPIC_API_KEY=sk-ant-...   # For AI report generation
DB_PATH=/data/guardops.db      # Railway persistent volume
```

### Frontend + Guard App (Vercel)
```
VITE_API_URL=https://your-backend.railway.app
```

## Default Credentials

**Admin CRM:** admin@strondis.com / admin123
**Guard App:** marcus.w@strondis.com / guard123
*(All demo guards use password: guard123)*

## Features

### Admin CRM
- Dashboard with live KPIs and revenue charts
- Officer management with SIA licence tracking
- Sites & Clients management
- Scheduling with calendar view
- Timesheet approval workflow
- Payroll processing
- **Incidents with AI report generation (BS 7499 compliant)**
- **SIA Compliance dashboard with expiry alerts**
- **Client Portal — generate secure links for clients**

### Guard App (Mobile)
- Clock in/out with GPS
- Today's shift with site address
- Incident reporting with bodycam flag
- Timesheet submission
- Messages + Emergency alert
- Schedule view

### Client Portal
- Secure token-based link (no login required)
- Live site coverage status
- Shift visibility
- Incident reports (including AI-generated reports)
- Patrol checkpoint log

## Deploying to Production

### 1. Backend → Railway
```bash
cd backend
railway login
railway init
railway up
# Add env vars in Railway dashboard
# Add a Volume at /data for persistent SQLite
```

### 2. Frontend → Vercel
```bash
cd frontend
vercel --prod
# Set VITE_API_URL in Vercel project settings
```

### 3. Guard App → Vercel
```bash
cd guard-app
vercel --prod
# Set VITE_API_URL in Vercel project settings
```

## Pricing Tiers (Reference)
- **Starter:** £149/mo — up to 15 officers, SIA tracker, scheduling
- **Professional:** £249/mo — up to 50 officers + AI reports + client portal
- **Enterprise:** £399/mo — unlimited + body-cam AI + API integrations
