# Hosting infrastructure for the Azure Cost Visibility Dashboard.
#
# Flow: this creates a resource group, a container registry (ACR), an App
# Service plan, and a Linux Web App that runs the container. The Web App gets a
# system-assigned managed identity, which is granted read-only roles (see
# rbac.tf) — so the running app authenticates to Azure with NO secrets.

# Random suffix keeps globally-unique names (ACR, web app) collision-free.
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

locals {
  acr_name = "${var.name_prefix}${random_string.suffix.result}" # alphanumeric only
  app_name = "${var.name_prefix}-${random_string.suffix.result}"
  scan_rg  = var.resource_group_to_scan != "" ? var.resource_group_to_scan : azurerm_resource_group.main.name
}

resource "azurerm_resource_group" "main" {
  name     = "${var.name_prefix}-rg"
  location = var.location
}

# Container registry to hold the app image.
resource "azurerm_container_registry" "acr" {
  name                = local.acr_name
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = false # we pull with the managed identity, not admin creds
}

# Linux App Service plan (B1 is the cheapest that runs custom containers).
resource "azurerm_service_plan" "main" {
  name                = "${var.name_prefix}-plan"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = "B1"
}

# The web app itself — runs the container and reads Azure via its identity.
resource "azurerm_linux_web_app" "app" {
  name                = local.app_name
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_service_plan.main.location
  service_plan_id     = azurerm_service_plan.main.id

  identity {
    type = "SystemAssigned"
  }

  site_config {
    # Pull the image from ACR using the managed identity (no registry passwords).
    container_registry_use_managed_identity = true

    application_stack {
      docker_image_name   = var.container_image
      docker_registry_url = "https://${azurerm_container_registry.acr.login_server}"
    }
  }

  app_settings = {
    # Tell App Service which port the container listens on (single-origin build).
    WEBSITES_PORT = "3001"

    # App config — the managed identity supplies credentials, so no secrets here.
    MOCK_DATA             = var.mock_data
    AZURE_SUBSCRIPTION_ID = var.subscription_id
    AZURE_RESOURCE_GROUP  = local.scan_rg

    # Optional features.
    ANTHROPIC_API_KEY = var.anthropic_api_key
    AUTH_USER         = var.auth_user
    AUTH_PASSWORD     = var.auth_password
  }
}
