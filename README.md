# Azure Cost Visibility Dashboard

**Industry Relevance:**  
Designed for **finance, healthcare, insurance, and e-commerce**, this enterprise-ready dashboard delivers **real-time Azure cost visibility**, **AI-powered spend optimization**, and **automated resource intelligence**—helping organizations improve governance, reduce cloud waste, and maintain compliance.

---

## Key Features

- Centralized Azure spend tracking with per-service cost breakdowns
- AI-powered cost analysis and idle resource detection
- Budget forecasting, burn-down charts, and automated alerts
- Interactive dashboards for finance, engineering, and cloud operations teams
- Secure Azure authentication using Managed Identity and RBAC
- Scalable containerized deployment on Azure Kubernetes Service (AKS)

---

## Screenshots

| Cost Overview | Idle Resource Hunter |
|:-------------:|:--------------------:|
| ![Cost Overview](images/cost-overview.png) | ![Idle Resource Hunter](images/idle-resource-hunter.png) |

> **Note:** Save your screenshots inside an **images** folder in your repository using the filenames:
>
> - `images/cost-overview.png`
> - `images/idle-resource-hunter.png`

---

## Business Value

Manual cloud cost tracking and uncontrolled spending can quickly become expensive, especially in regulated industries.

This solution provides finance and cloud teams with a **single source of truth** for Azure spending by delivering:

- Real-time cloud cost visibility
- Early detection of overspending
- Automated budget monitoring
- AI-driven optimization recommendations
- Audit-ready reporting for compliance teams

The result is **greater financial transparency, improved governance, and lower Azure operating costs.**

---

## Tech Stack

### Backend

- Node.js
- Express.js
- Azure Cost Management APIs
- Azure Functions

### Frontend

- React
- Tailwind CSS
- Recharts

### AI Layer

- Anthropic Claude for intelligent cost analysis and optimization recommendations

### Cloud Platform

- Microsoft Azure
- Azure Kubernetes Service (AKS)
- Azure Container Registry (ACR)

### Security

- Azure Managed Identity
- Azure RBAC
- Azure Identity SDK
- HTTP Basic Authentication
- Azure CORS Configuration

---

## Azure Deployment Architecture

### Local Development

- Built an Azure Functions Node.js v4 backend using Visual Studio Code
- Integrated Azure Identity and Azure Cost Management SDKs
- Developed REST APIs to retrieve Azure Daily Actual Cost data
- Tested all endpoints locally on `localhost:7071`

### Azure Infrastructure

- Logged into Azure using Azure CLI
- Created an isolated Azure Resource Group
- Provisioned Azure Storage Account
- Built and deployed an Azure Kubernetes Service (AKS) cluster
- Containerized frontend and backend services using Docker
- Deployed workloads to AKS for high availability and scalability

### Security Implementation

- Published backend using Azure Functions Core Tools
- Stored container images in Azure Container Registry (ACR)
- Enabled System-Assigned Managed Identity
- Assigned least-privilege **Cost Management Reader** role using Azure RBAC
- Configured CORS to allow only the frontend application

### Application Integration

- Connected the React frontend to the live Azure Function APIs
- Updated API endpoints to communicate with Azure services
- Validated end-to-end communication
- Monitored application health using Azure Log Streams and AKS monitoring

---

## Value Delivered

✔ Real-time Azure cost visibility across cloud services

✔ AI-powered detection of idle and underutilized resources

✔ Automated spend monitoring and budget alerts

✔ Reduced manual reporting through centralized dashboards

✔ Secure authentication using Managed Identity

✔ Enterprise-grade scalability with Azure Kubernetes Service (AKS)

✔ Improved cloud governance and financial accountability

---

## Future Enhancements

- Multi-subscription Azure support
- Department-level cost allocation
- Power BI integration
- Predictive AI cost forecasting
- Email and Microsoft Teams budget notifications
- Azure Advisor integration
- Cost anomaly detection using Azure Monitor

---

## Author

**Magela Bobby Akinola**

- **LinkedIn:** https://linkedin.com/in/magela-akinola
- **Portfolio:** https://magela84.github.io/magela-portfolio-website/
- **GitHub:** https://github.com/Magela84
