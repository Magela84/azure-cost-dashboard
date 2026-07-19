Azure Cost Visibility DashboardOverviewA full-stack dashboard for visualizing Azure spend, budget alerts, resource utilization, and Logic App workflow status. The backend uses Node.js/Express to query Azure’s management APIs, while a React + Tailwind frontend renders interactive charts and dashboards. The platform includes AI-powered cost analysis and an Idle Resource Hunter for cost optimization.Problem StatementCloud cost overruns and lack of visibility threatened financial control for Azure workloads:
No consolidated dashboard for spend or budgets
Manual tracking of idle resources and workflow health
No automated insights or AI-driven cost-saving recommendations
Features
Cost overview & by-service: Daily spend trends and per-service breakdown (Recharts)
Forecasting & budget burn-down: Month-end spend projection vs. budget
Budget alerts: Progress bars and notifications from Azure Consumption API
Logic Apps status: Real-time workflow health and run history
✨ AI Cost Analyst: Natural language cost analysis with Anthropic’s Claude model
🧹 Idle Resource Hunter: Detects and estimates waste from unattached disks, idle VMs, stale snapshots, and more, with actionable recommendations
Tech Stack
































LayerTechnologyBackendNode.js, ExpressFrontendReact, Tailwind CSS, Recharts, ViteAzure@azure/arm-costmanagement, @azure/arm-consumption, @azure/arm-monitor,@azure/arm-logic, @azure/arm-compute, @azure/arm-network, @azure/identityAI@anthropic-ai/sdk (Claude) – powers the AI Cost AnalystAuthDefaultAzureCredential (env vars, managed identity, Azure CLI login)Prerequisites
Node.js 18+
Azure subscription with cost data
IAM roles: Cost Management Reader, Monitoring Reader, Logic Apps Contributor, Reader
Azure CLI (az login) or service principal credentials
(For mock mode: no Azure credentials required)
Project Structureazure-cost-dashboard/├── package.json├── backend/│   ├── server.js│   ├── middleware/│   ├── routes/│   ├── services/│   ├── mocks/│   └── .env.example├── frontend/│   ├── src/│   ├── index.html└── README.mdSetup

Clone the repo:
git clone https://github.com/Magela84/azure-cost-dashboard.gitcd azure-cost-dashboard


Install dependencies (root + backend + frontend):
npm run install:all``


Configure environment:
cp backend/.env.example backend/.env# Edit backend/.env with your credentials

RunningMock mode (no Azure credentials required)
Run backend with demo data:
npm run mock

In a separate terminal, run frontend:
npm --prefix frontend run dev

Real Azure mode
Fill in backend/.env with Azure creds and set MOCK_DATA=false
Start both apps:
npm run dev

Deployment
Docker Compose:
docker compose up --build

Docker:
docker build -t azure-cost-dashboard .docker run -p 3001:3001 --env-file backend/.env azure-cost-dashboard

Azure (Terraform):
See terraform/README.md for full cloud deployment instructions.
Authentication
Set AUTH_USER and AUTH_PASSWORD for HTTP Basic Auth on all endpoints.
Always run behind HTTPS in production for secure credential transmission.
API Endpoints

















































MethodPathDescriptionGET/api/healthHealth checkGET/api/costs/overviewTotal spend / daily trendGET/api/costs/by-serviceSpend grouped by serviceGET/api/alertsBudget alertsGET/api/costs/forecastSpend projection & budget burn-downGET/api/logicappsLogic App workflow statusPOST/api/analyst/askAI Cost Analyst — ask questions in plain EnglishGET/api/idleIdle/orphaned resources and estimated wasteScreenshots




















ViewScreenshotDashboard overviewdocs/screenshot-dashboard.pngCost by servicedocs/screenshot-by-service.pngBudget alertsdocs/screenshot-alerts.pngValue Delivered
Centralized, real-time Azure cost visibility
AI-powered recommendations for cost savings
Automated detection of idle resources and spend anomalies
Ready-to-use dashboards for finance, engineering, and cloud teams
AuthorMagela Bobby Akinola
LinkedIn | Portfolio | GitHub
