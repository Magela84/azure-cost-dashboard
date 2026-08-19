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
- One-click cleanup of idle/orphaned resources (destroy VMs, disks, snapshots, and orphaned public IPs directly from the Idle Resource Hunter)
- Right-size Azure VMs with a click (resize up or down from the **VM Scaling** section, using only the sizes Azure reports as available)
- Utilization-based **right-sizing recommendations** with monthly savings estimates (find over- and under-provisioned VMs and apply downsizes directly)
- Interactive dashboards for finance, engineering, and cloud operations teams
- Secure Azure authentication using Managed Identity and RBAC
- Scalable containerized deployment on Azure Kubernetes Service (AKS)

---

## Screenshots

| Cost Overview | Idle Resource Hunter |
|:-------------:|:--------------------:|
| ![Cost Overview](screenshots/overview.png) | ![Idle Resource Hunter](screenshots/idle-hunter.png) |

| Forecasting | Budget Alerts |
|:-----------:|:-------------:|
| ![Forecasting](screenshots/forecast.png) | ![Budget Alerts](screenshots/budget-alerts.png) |

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
- HTTP Basic Authentication (fallback)
- Microsoft Entra ID / OIDC authentication with Operator RBAC
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

## Destroying Idle Resources

The **Idle Resource Hunter** can also permanently delete the waste it finds. Select
resources, click **Destroy selected**, and confirm — each finding is deleted one by
one and the results (plus the audit trail) are shown.

### What each type does

| Type | Action |
|------|--------|
| Idle VM / Deallocated VM | Deletes the VM **and** its managed OS/data disks |
| Unattached Disk | Deletes the managed disk |
| Stale Snapshot | Deletes the snapshot |
| Unassociated Public IP | Deletes the public IP address |

> **⚠️ Warning:** Deletion is irreversible. VMs are deleted along with their disks
> (data loss). The UI always requires an explicit confirmation before anything runs.

### Safety & permissions

- **Confirmation required** — all destructive requests must include `confirm: true`
- **Full audit trail** — every action is logged to an audit endpoint and optionally forwarded to Log Analytics/SIEM
- **Scoped operations** — resource IDs are restricted to the configured subscription and resource group
- **Role-based access** — the service principal needs delete rights; destructive actions require Operator role with OIDC
- **Authentication** — secured with Basic Auth, Microsoft Entra ID, or OIDC (production fails closed if unconfigured)
- **Mock mode** — run with `MOCK_DATA=true` to demo without Azure credentials

---

## Scaling VMs Up / Down

The **VM Scaling** section lists every VM with its current size and the sizes Azure
reports as available for that VM. Pick a target size, click **Scale**, and confirm.

### Behavior & safety

- Resizing is attempted in place (no downtime). If Azure rejects that for a running VM
  (target size not available on the current host), the backend falls back to
  **deallocate → resize → start**, which briefly restarts the VM.
- The API requires `confirm: true` in the request body — a plain request is rejected with `400`.
- The UI shows a warning before any resize, and marks upscales ▲ / downscales ▼.
- Every resize is recorded in an audit log, exposed at `GET /api/scale/audit`
  (in-memory; also mirrored to `backend/logs/scale-audit.jsonl` on a best-effort basis).
- The service principal behind `DefaultAzureCredential` must have resize rights, e.g. the
  **Contributor** role or a custom role granting `Microsoft.Compute/virtualMachines/write`.

In mock mode (`MOCK_DATA=true`) resizes are simulated in-memory, so the flow is fully
demoable without Azure credentials.

---

## Right-Sizing Recommendations

The **Right-Sizing** section uses VM utilization (CPU + memory, last 14 days of Azure
Monitor metrics) to flag VMs that are over- or under-provisioned, and shows the estimated
monthly cost impact of the recommended size:

- **▼ downsize** — utilization is comfortably below capacity; the recommendation saves money
  each month (`current size → cheaper size`, savings shown as `−$/mo`).
- **▲ upsize** — utilization is consistently above 85%; the VM is at risk of
  under-provisioning, and the extra cost of the larger size is shown as `+$/mo`.
- Recommended sizes are chosen from the same Azure-available size list used by VM Scaling,
  sized so the projected utilization after the change lands in a healthy band
  (~35–80% CPU, ~50% memory).
- Apply a downsize directly from the card — it reuses the **VM Scaling** resize flow, with the
  same confirmation and audit-log safety, so both cards stay in sync.
- Costs use pay-as-you-go list prices; the numbers are guidance, not a billing invoice.

The service principal behind `DefaultAzureCredential` needs read access to Azure Monitor
metrics (`Microsoft.Insights/Metrics/Read`, e.g. the **Monitoring Reader** role).

In mock mode (`MOCK_DATA=true`) utilization comes from simulated values, so the feature is
fully demoable without Azure credentials.

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
