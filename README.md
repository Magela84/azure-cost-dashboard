Azure Cost Visibility DashboardIndustry Focus:
Built for finance, healthcare, insurance, and e-commerce, this dashboard provides real-time Azure spend visibility, AI-powered cost control, and automated resource optimization—addressing strict compliance and transparency needs.Key Features
Centralized Azure spend tracking with clear per-service breakdowns
AI-driven cost analysis, including idle resource detection
Budget forecasts, burn-down charts, and automated alerts
Ready-made dashboards for finance, engineering, and cloud teams
Screenshots












Cost OverviewIdle Resource Hunter[Image blocked: overview][Image blocked: idle-hunter]Business ValueManual tracking and cloud cost overruns can threaten financial control, especially in regulated sectors.
This dashboard empowers proactive savings, quick audits, and audit-ready compliance by centralizing cost analytics and automating budget alerts.Tech Stack
Backend: Node.js, Express, Azure APIs
Frontend: React, Tailwind CSS, Recharts
AI Layer: Anthropic Claude for advanced cost intelligence
Authentication: Azure Identity & HTTP Basic Auth
How I Connected the App to Azure1. Local Development
Initialized an Azure Functions Node.js v4 backend using VS Code
Installed the official Azure Identity and Cost Management SDKs
Developed API endpoints to query Daily Actual Costs from the Azure subscription
Successfully tested data output locally on localhost:7071
2. Infrastructure Setup
Logged into Azure via the Azure CLI from the local workspace
Automated the creation of an isolated Resource Group and Storage Account in Azure
Provisioned a live, serverless Azure Function App running Node.js 24
3. Cloud Security Hardening
Deployed the backend to Azure using the Core Tools publisher
Enabled a passwordless System-Assigned Managed Identity for secure cloud authentication
Assigned Least-Privilege Cost Management Reader (RBAC) permissions to the app identity
Hardened network security by whitelisting the frontend Render website domain via CORS
4. Code Integration
Opened the online frontend code repository in GitHub
Updated the data source URL to point to the live Azure Function API
Verified the end-to-end data loop was live and healthy using Azure Log Streams
Value Delivered
Real-time Azure cost visibility—no more manual spreadsheets!
Automated anomaly and idle resource detection
AI-powered recommendations for savings and regulatory compliance
AuthorMagela Bobby Akinola
LinkedIn | Portfolio | GitHub
