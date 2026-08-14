# Hosting infrastructure for the Azure Cost Visibility Dashboard.
#
# Flow: this creates a resource group, a container registry (ACR), a Key Vault
# for secrets, an App Service plan, and a Linux Web App that runs the container.
# The Web App gets a system-assigned managed identity — it authenticates to
# Azure and pulls its container image with NO stored credentials, and reads
# secrets at runtime from Key Vault (never from app settings).
#
# Least privilege (see rbac.tf):
#   - Default: read-only roles only (costs, monitoring, registry pull). The
#     Destroy / VM-resize features CANNOT run until you set
#     enable_destructive_actions = true, which adds a custom role scoped to a
#     single resource group.
#   - All resource names get a random suffix so they stay globally unique.

resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

locals {
  acr_name = "${var.name_prefix}${random_string.suffix.result}" # alphanumeric only
  app_name = "${var.name_prefix}-${random_string.suffix.result}"
  kv_name  = "${var.name_prefix}kv${random_string.suffix.result}"
  scan_rg  = var.resource_group_to_scan != "" ? var.resource_group_to_scan : azurerm_resource_group.main.name

  # Secret URI references handed to the Web App. Secrets live ONLY in Key Vault;
  # App Service resolves them at runtime using its managed identity.
  kv_secret_settings = merge(
    length(azurerm_key_vault_secret.anthropic_key) > 0
    ? { ANTHROPIC_API_KEY = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.anthropic_key[0].id})" }
    : {},
    length(azurerm_key_vault_secret.auth_password) > 0
    ? { AUTH_PASSWORD = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.auth_password[0].id})" }
    : {},
    length(azurerm_key_vault_secret.oidc_client_secret) > 0
    ? { OIDC_CLIENT_SECRET = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.oidc_client_secret[0].id})" }
    : {},
    length(azurerm_key_vault_secret.oidc_session_secret) > 0
    ? { OIDC_SESSION_SECRET = "@Microsoft.KeyVault(SecretUri=${azurerm_key_vault_secret.oidc_session_secret[0].id})" }
    : {},
  )
}

resource "azurerm_resource_group" "main" {
  name     = "${var.name_prefix}-rg"
  location = var.location
}

# Container registry to hold the app image. Admin credentials stay DISABLED —
# the Web App pulls with its managed identity, so there are no registry secrets
# to leak or rotate.
resource "azurerm_container_registry" "acr" {
  name                   = local.acr_name
  resource_group_name    = azurerm_resource_group.main.name
  location               = azurerm_resource_group.main.location
  sku                    = "Basic"
  admin_enabled          = false
  anonymous_pull_enabled = false
}

# Key Vault for secrets (ANTHROPIC_API_KEY, AUTH_PASSWORD). RBAC authorization
# for the data plane; only the Web App's identity and your Terraform/operator
# principal can read secrets.
resource "azurerm_key_vault" "main" {
  name                       = local.kv_name
  resource_group_name        = azurerm_resource_group.main.name
  location                   = azurerm_resource_group.main.location
  tenant_id                  = data.azurerm_subscription.current.tenant_id
  sku_name                   = "standard"
  rbac_authorization_enabled = true
  soft_delete_retention_days = 90
  purge_protection_enabled   = false # set true if your policy requires it
}

resource "azurerm_key_vault_secret" "anthropic_key" {
  count        = var.anthropic_api_key != "" ? 1 : 0
  name         = "anthropic-api-key"
  value        = var.anthropic_api_key
  key_vault_id = azurerm_key_vault.main.id
}

resource "azurerm_key_vault_secret" "auth_password" {
  count        = var.auth_password != "" ? 1 : 0
  name         = "auth-password"
  value        = var.auth_password
  key_vault_id = azurerm_key_vault.main.id
}

resource "azurerm_key_vault_secret" "oidc_client_secret" {
  count        = var.oidc_client_secret != "" ? 1 : 0
  name         = "oidc-client-secret"
  value        = var.oidc_client_secret
  key_vault_id = azurerm_key_vault.main.id
}

resource "azurerm_key_vault_secret" "oidc_session_secret" {
  count        = var.oidc_session_secret != "" ? 1 : 0
  name         = "oidc-session-secret"
  value        = var.oidc_session_secret
  key_vault_id = azurerm_key_vault.main.id
}

# Linux App Service plan (B1 is the cheapest that runs custom containers).
resource "azurerm_service_plan" "main" {
  name                = "${var.name_prefix}-plan"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = "B1"
}

# The web app itself — runs the container, reads Azure via its identity, and
# pulls secrets from Key Vault at runtime.
resource "azurerm_linux_web_app" "app" {
  name                    = local.app_name
  resource_group_name     = azurerm_resource_group.main.name
  location                = azurerm_service_plan.main.location
  service_plan_id         = azurerm_service_plan.main.id
  https_only              = true
  client_affinity_enabled = false

  identity {
    type = "SystemAssigned"
  }

  site_config {
    # Pull the image from ACR using the managed identity (no registry passwords).
    container_registry_use_managed_identity = true

    # Disable FTP-style publishing entirely; only HTTPS deployments are allowed.
    ftps_state = "Disabled"

    application_stack {
      docker_image_name   = var.container_image
      docker_registry_url = "https://${azurerm_container_registry.acr.login_server}"
    }
  }

  app_settings = merge(
    {
      # Tell App Service which port the container listens on (single-origin build).
      WEBSITES_PORT = "3001"

      # App config — the managed identity supplies credentials, so no secrets here.
      MOCK_DATA             = var.mock_data
      AZURE_SUBSCRIPTION_ID = var.subscription_id
      AZURE_RESOURCE_GROUP  = local.scan_rg

      # Basic Auth is only enabled when BOTH user and password resolve.
      AUTH_USER = var.auth_user

      # Entra ID / OIDC login (takes precedence over Basic Auth when all four
      # OIDC_* values resolve). Client secret and session secret come from Key
      # Vault via the kv_secret_settings merge above.
      OIDC_CLIENT_ID     = var.oidc_client_id
      OIDC_TENANT_ID     = var.oidc_tenant_id
      APP_BASE_URL       = var.app_base_url
      OIDC_OPERATOR_ROLES = var.oidc_operator_roles
    },
    local.kv_secret_settings,
  )
}
