# Terraform — deploy the dashboard to Azure

Provisions everything needed to host the Azure Cost Visibility Dashboard:

| Resource | Purpose |
|---|---|
| Resource group | Holds the hosting resources |
| Container Registry (ACR) | Stores the app's Docker image |
| App Service plan (Linux, B1) | Compute to run the container |
| Linux Web App | Runs the container on port 3001 |
| **System-assigned managed identity** | Lets the app read Azure **with no secrets** |
| Role assignments | `AcrPull` + read-only `Cost Management Reader` / `Reader` / `Monitoring Reader` |

The running app authenticates to Azure through its managed identity via
`DefaultAzureCredential`, so there are **no client secrets** anywhere.

## Prerequisites
- [Terraform](https://developer.hashicorp.com/terraform/downloads) ≥ 1.5
- [Azure CLI](https://learn.microsoft.com/cli/azure/), logged in: `az login`
- Permission to create resources **and assign roles** in the subscription
  (Owner, or Contributor + User Access Administrator)
- Docker (to build and push the image)

## Deploy

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars   # then set your subscription_id

terraform init
terraform apply                                 # creates RG, ACR, plan, web app, roles
```

Then build the image (from the **repo root**, using the all-in-one `Dockerfile`)
and push it to the registry Terraform just created:

```bash
ACR=$(terraform -chdir=terraform output -raw acr_name)
LOGIN=$(terraform -chdir=terraform output -raw acr_login_server)

az acr login --name "$ACR"
docker build -t "$LOGIN/azure-cost-dashboard:latest" .
docker push "$LOGIN/azure-cost-dashboard:latest"

# Restart so the web app pulls the freshly pushed image
az webapp restart --name "$(terraform -chdir=terraform output -raw web_app_name)" \
  --resource-group "$(terraform -chdir=terraform output -raw resource_group_name)"
```

Open the app:

```bash
terraform -chdir=terraform output -raw app_url
```

> **Ordering note:** the Web App is created before the image exists, so its first
> pull fails until you push and restart (above). That's expected.

## Notes
- **Managed identity vs. secrets:** because the app runs on Azure with a managed
  identity that has the read roles, you don't set `AZURE_CLIENT_SECRET` — leave
  it out entirely. This is the recommended production auth model.
- **Real vs. mock:** set `mock_data = "false"` (default) for live data, or
  `"true"` to run the demo without touching real resources.
- **Cost:** the B1 plan + Basic ACR are inexpensive but not free. Run
  `terraform destroy` when you're done to avoid ongoing charges.
- **State & secrets:** `*.tfstate` and `terraform.tfvars` are gitignored — never
  commit them. For team use, configure a remote backend (e.g. Azure Storage).
