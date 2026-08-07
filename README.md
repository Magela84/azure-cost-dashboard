# Azure Cost Visibility Dashboard

## Industry Relevance

Designed for **finance, healthcare, insurance, and e-commerce**, this enterprise-ready dashboard delivers **real-time Azure cost visibility**, **AI-powered spend optimization**, and **automated resource intelligence**—helping organizations improve governance, reduce cloud waste, and maintain compliance.

---

## Project Overview

The **Azure Cost Visibility Dashboard** is an enterprise cloud cost management solution that provides real-time visibility into Azure spending, AI-powered cost analysis, and automated resource optimization. Built with **React**, **Node.js**, **Azure Functions**, and **Azure Kubernetes Service (AKS)**, the application securely retrieves Azure Cost Management data using **Azure Managed Identity** and **Role-Based Access Control (RBAC)**. It enables finance, engineering, and cloud operations teams to monitor cloud costs, identify optimization opportunities, reduce unnecessary spending, and strengthen cloud governance across Azure environments.

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
| ![Cost Overview](screenshots/cost-overview.png) | ![Idle Resource Hunter](screenshots/idle-resource-hunter.png) |

---

## Business Value

Manual cloud cost tracking and uncontrolled spending can threaten financial control, especially in regulated industries. This dashboard empowers organizations to reduce cloud waste, improve financial governance, simplify audits, and maintain compliance by centralizing cost analytics and automating budget monitoring.

---

## Tech Stack

### Backend

- Node.js
- Express.js
- Azure Functions
- Azure Cost Management APIs

### Frontend

- React
- Tailwind CSS
- Recharts

### AI

- Anthropic Claude

### Cloud Platform

- Azure Kubernetes Service (AKS)
- Azure Container Registry (ACR)

### Security

- Azure Managed Identity
- Role-Based Access Control (RBAC)
- HTTP Basic Authentication
- CORS Configuration

---

## Deployment

### 1. Local Development

- Initialized an Azure Functions Node.js v4 backend using Visual Studio Code
- Installed Azure Identity and Azure Cost Management SDKs
- Developed REST APIs to retrieve Daily Actual Cost data from Azure
- Tested the application locally on `localhost:7071`

### 2. Infrastructure & AKS Deployment

- Logged into Azure using Azure CLI
- Created an isolated Resource Group and Storage Account
- Provisioned an Azure Kubernetes Service (AKS) cluster
- Built and containerized application images
- Deployed containers to AKS for scalable, highly available hosting

### 3. Cloud Security

- Published backend services using Azure Functions Core Tools and Azure Container Registry
- Enabled System-Assigned Managed Identity for passwordless authentication
- Assigned the Cost Management Reader role using Azure RBAC
- Configured CORS to allow only the frontend application

### 4. Application Integration

- Connected the React frontend to the live Azure Function APIs
- Updated API endpoints to communicate with Azure services
- Verified end-to-end connectivity using Azure Log Streams and AKS monitoring

---

## Value Delivered

- Real-time Azure cost visibility across cloud services
- Automated detection of spend anomalies and idle resources
- AI-powered recommendations for cost savings
- Improved cloud governance and financial transparency
- Secure authentication using Azure Managed Identity
- Enterprise-ready scalability with Azure Kubernetes Service (AKS)

---

## Author

**Magela Bobby Akinola**

- LinkedIn: https://linkedin.com/in/magela-akinola
- Portfolio: https://magela84.github.io/magela-portfolio-website/
- GitHub: https://github.com/Magela84
