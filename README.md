# Azure Cost Visibility Dashboard

A full-stack dashboard for visualizing Azure spend, budget alerts, and Logic App
workflow status. A Node.js/Express backend queries the Azure management SDKs and
a React + Tailwind frontend renders the data with Recharts.

## Tech Stack

| Layer    | Technology |
|----------|------------|
| Backend  | Node.js, Express |
| Frontend | React, Tailwind CSS, Recharts, Vite |
| Azure    | `@azure/arm-costmanagement`, `@azure/arm-consumption`, `@azure/arm-monitor`, `@azure/arm-logic`, `@azure/identity` |
| Auth     | `DefaultAzureCredential` (env vars, managed identity, or Azure CLI login) |

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
| GET | `/api/logicapps` | Logic App workflow status |

Errors are returned as `{ error: true, message, code, timestamp }`.

## Screenshots

<!-- Add screenshots of the running dashboard here. -->

| View | Screenshot |
|------|------------|
| Dashboard overview | _`docs/screenshot-dashboard.png` (placeholder)_ |
| Cost by service | _`docs/screenshot-by-service.png` (placeholder)_ |
| Budget alerts | _`docs/screenshot-alerts.png` (placeholder)_ |
