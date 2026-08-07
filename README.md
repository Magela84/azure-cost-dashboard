Azure Cost Visibility DashboardOverviewThe Azure Cost Visibility Dashboard is a cloud-native solution designed to provide organizations in finance, healthcare, insurance, and e-commerce with real-time insights into Azure expenditure. Leveraging AI-powered analytics, it enables proactive cost control and automated resource optimization while supporting strict compliance requirements.Features
Centralized Cost Tracking: Unified view of Azure spending with detailed per-service breakdowns.
AI-Powered Analytics: Automated analysis to detect idle resources and spending anomalies.
Forecasting & Alerts: Predictive budget forecasts, burn-down charts, and automated alerting to prevent overruns.
Role-Based Dashboards: Ready-made dashboards tailored for finance, engineering, and cloud operations teams.
Architecture & Technology
Backend: Node.js, Express, Azure APIs
Frontend: React, Tailwind CSS, Recharts
AI Integration: Anthropic Claude for advanced cost intelligence
Containerization & Orchestration: Azure Kubernetes Service (AKS)
Authentication: Azure Identity & HTTP Basic Auth
Implementation Approach1. Local Development
Initiated an Azure Functions Node.js v4 backend using Visual Studio Code.
Integrated Azure Identity and Cost Management SDKs for secure, robust API development.
Built and validated endpoints for extracting daily actual cost data from the Azure subscription.
2. Infrastructure & AKS Deployment
Utilized Azure CLI for seamless cloud integration and resource management.
Automated provisioning of an isolated Resource Group and Storage Account.
Established a production-grade AKS cluster to deploy and scale containerized application components.
3. Security & Compliance
Deployed backend services and containers via Azure Core Tools and Azure Container Registry.
Enabled System-Assigned Managed Identity for secure, passwordless authentication.
Applied Least-Privilege (RBAC) permissions to enforce security best practices.
Configured CORS to restrict API access to trusted frontend domains.
4. CI/CD & Monitoring
Integrated codebase with GitHub for version control and collaborative development.
Updated data endpoints to leverage live Azure Function APIs and AKS services.
Monitored operational health using Azure Log Streams and AKS monitoring tools to ensure reliability and performance.
Screenshots












Cost OverviewIdle Resource Hunter[Image blocked: Cost Overview][Image blocked: Idle Resource Hunter]Business Impact
Operational Transparency: Immediate visibility into cloud spending for all stakeholders.
Cost Optimization: Data-driven recommendations and AI-based detection of cost-saving opportunities.
Regulatory Readiness: Automated reporting and alerting for compliance and audit preparation.
Scalability & Reliability: Enterprise-grade architecture via containerization and AKS orchestration.
AuthorMagela Bobby Akinola
LinkedIn | Portfolio | GitHub
