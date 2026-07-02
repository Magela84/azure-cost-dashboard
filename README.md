# Azure Cost Visibility Dashboard

[![CI](https://github.com/Magela84/Azure-Cost-optimization-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/Magela84/Azure-Cost-optimization-tools/actions/workflows/ci.yml)

A full-stack dashboard for visualizing Azure spend, budget alerts, and Logic App
workflow status. A Node.js/Express backend queries the Azure management SDKs and
a React + Tailwind frontend renders the data with Recharts.

## Tech Stack

| Layer    | Technology |
|----------|------------|
| Backend  | Node.js, Express |
| Frontend | React, Tailwind CSS, Recharts, Vite |
| Azure    | `@azure/arm-costmanagement`, `@azure/arm-consumption`, `@azure/arm-monitor`, `@azure/arm-logic`, `@azure/arm-compute`, `@azure/arm-network`, `@azure/identity` |
| AI       | `@anthropic-ai/sdk` (Claude `claude-opus-4-8`) — powers the AI Cost Analyst |
| Auth     | `DefaultAzureCredential` (env vars, managed identity, or Azure CLI login) |

## Features

- **Cost overview & by-service** — daily spend trend and per-service breakdown (Recharts).
- **Spend forecast & budget burn-down** — trend-based month-end projection vs. budget.
- **Budget alerts** — Consumption budgets with spend-vs-amount progress bars.
- **Logic Apps status** — workflow state and latest run status.
- **✨ AI Cost Analyst** — ask questions about your spend in plain English
  ("Where can I save money this month?"). The backend feeds your live cost data
  to Claude and streams the answer back token-by-token. Requires
  `ANTHROPIC_API_KEY`; works in mock mode too (mock numbers, real analysis).
- **🧹 Idle Resource Hunter** — scans for resources that cost money but do
  nothing (unattached disks, unassociated public IPs, stale snapshots,
  deallocated VMs, and running VMs sitting near-idle on CPU) and headlines total
  estimated monthly waste, with a suggested action per finding. Idle-VM
  detection queries `Percentage CPU` over a 14-day window via `@azure/arm-monitor`
  (implemented; not yet validated against a live subscription).

> **Note:** Azure *budgets* (amount, current spend, notification thresholds) come
> from the Consumption API, so budget alerts use `@azure/arm-consumption`.
> `@azure/arm-monitor` is included for future metric/activity-log alerts.

## Prerequisites

- **Node.js 18+** (the backend dev script uses `node --watch`)
- An **Azure subscription** with cost data
- **IAM roles** on the subscription for the identity you authenticate with:
  - **Cost Management Reader** — cost/usage and budget queries
  - **Monitoring Reader** — metrics/alerts
  - **Logic Apps Contributor** — read Logic App workflows and run history
  - **Reader** — enumerate disks, public IPs, snapshots, and VMs (Idle Resource Hunter)
- Either the [Azure CLI](https://learn.microsoft.com/cli/azure/) (`az login`) **or**
  a service principal (see [Azure Credentials](#azure-credentials))
- *(Mock mode needs none of the Azure prerequisites — see [Running](#running).)*

## Project Structure

```
azure-cost-dashboard/
├── package.json               # root scripts: dev / build / mock
├── backend/
│   ├── server.js              # Express entry point
│   ├── middleware/
│   │   └── errorHandler.js    # central JSON error handler
│   ├── routes/                # costs.js, alerts.js, logicapps.js
│   ├── services/              # azureCostService, azureMonitorService, logicAppsService
│   ├── mocks/                 # costs.js, alerts.js, logicApps.js (demo data)
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/        # CostOverview, CostByService, BudgetAlerts, LogicAppsStatus, DateRangePicker
│   │   ├── pages/             # Dashboard.jsx
│   │   ├── api.js             # fetch layer + useFetch hook
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── index.html
└── README.md
```

## Setup

```bash
# 1. Clone
git clone <your-repo-url>
cd azure-cost-dashboard

# 2. Install dependencies (root + backend + frontend)
npm run install:all

# 3. Configure environment
cp backend/.env.example backend/.env
#    then edit backend/.env and fill in your credentials
```

### Environment Variables (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `AZURE_SUBSCRIPTION_ID` | Target subscription for cost queries |
| `AZURE_TENANT_ID` | Azure AD tenant (service principal auth) |
| `AZURE_CLIENT_ID` | Service principal app ID |
| `AZURE_CLIENT_SECRET` | Service principal secret |
| `AZURE_RESOURCE_GROUP` | Resource group scoping Logic App queries |
| `PORT` | Backend port (default `3001`) |
| `MOCK_DATA` | `true` serves demo data with no Azure calls |
| `ANTHROPIC_API_KEY` | Enables the AI Cost Analyst ([console.anthropic.com](https://console.anthropic.com/)) |

## Running

Run these from the project root (`azure-cost-dashboard/`).

### Mock mode (no Azure credentials required)

Serves realistic hardcoded data from `backend/mocks/` — ideal for demos and
frontend work.

```bash
npm run mock                 # backend on :3001 with MOCK_DATA=true
npm --prefix frontend run dev  # frontend on :3000 (separate terminal)
```

Alternatively, set `MOCK_DATA=true` in `backend/.env` and use `npm run dev`.

### Real Azure mode

With `backend/.env` filled in (and `MOCK_DATA=false`), run both apps together:

```bash
npm run dev
```

This uses `concurrently` to start:
- **backend** → `http://localhost:3001`
- **frontend** → `http://localhost:3000` (proxies `/api` to the backend)

### npm scripts (root `package.json`)

| Script | What it does |
|--------|--------------|
| `npm run dev` | Runs backend + frontend together via `concurrently` |
| `npm run build` | Builds the React frontend (`frontend/dist`) |
| `npm run mock` | Runs the backend with `MOCK_DATA=true` |
| `npm run install:all` | Installs root, backend, and frontend deps |

## Testing

The backend has unit tests for the pure logic (forecast math, idle-resource
aggregation) using Node's built-in test runner — no extra dependencies:

```bash
cd backend
npm test
```

## Azure Credentials

The backend authenticates with `DefaultAzureCredential`, which tries several
methods in order. Use whichever fits your environment.

### Option A — Service principal (env vars)

Create a service principal with cost-read access:

```bash
az ad sp create-for-rbac \
  --name "azure-cost-dashboard" \
  --role "Cost Management Reader" \
  --scopes /subscriptions/<SUBSCRIPTION_ID>
```

Map the output into `backend/.env` (`appId` → `AZURE_CLIENT_ID`, `password` →
`AZURE_CLIENT_SECRET`, `tenant` → `AZURE_TENANT_ID`). Grant the additional roles
from [Prerequisites](#prerequisites) as needed.

### Option B — Azure CLI login (local dev)

```bash
az login
az account set --subscription <SUBSCRIPTION_ID>
```

Then set only `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, and `PORT`.

### Option C — Managed identity

When deployed to Azure (App Service, Container Apps, VM, etc.), assign a managed
identity with the required roles. No secrets needed.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/costs/overview` | Total spend / daily trend (`?from=&to=`) |
| GET | `/api/costs/by-service` | Spend grouped by service (`?from=&to=`) |
| GET | `/api/alerts` | Budget alerts |
| GET | `/api/costs/forecast` | Month-end spend projection + budget burn-down |
| GET | `/api/logicapps` | Logic App workflow status |
| POST | `/api/analyst/ask` | AI Cost Analyst — streams a Claude answer (SSE) for `{ question }` |
| GET | `/api/idle` | Idle/orphaned resources with estimated monthly waste |

Errors are returned as `{ error: true, message, code, timestamp }`.

## Screenshots

<!-- Add screenshots of the running dashboard here. -->

| View | Screenshot |
|------|------------|
| Dashboard overview | _`docs/screenshot-dashboard.png` (placeholder)_ |
| Cost by service | _`docs/screenshot-by-service.png` (placeholder)_ |
| Budget alerts | _`docs/screenshot-alerts.png` (placeholder)_ |
