# Role assignments for the app's managed identity.
#
# Least-privilege, all read-only:
#   - AcrPull            → pull the container image from the registry
#   - Cost Management Reader → spend & budget queries (subscription scope)
#   - Reader                 → list disks, IPs, snapshots, VMs (idle scan)
#   - Monitoring Reader      → read VM CPU metrics

data "azurerm_subscription" "current" {}

locals {
  app_principal_id = azurerm_linux_web_app.app.identity[0].principal_id
}

resource "azurerm_role_assignment" "acr_pull" {
  scope                = azurerm_container_registry.acr.id
  role_definition_name = "AcrPull"
  principal_id         = local.app_principal_id
}

resource "azurerm_role_assignment" "cost_management_reader" {
  scope                = data.azurerm_subscription.current.id
  role_definition_name = "Cost Management Reader"
  principal_id         = local.app_principal_id
}

resource "azurerm_role_assignment" "reader" {
  scope                = data.azurerm_subscription.current.id
  role_definition_name = "Reader"
  principal_id         = local.app_principal_id
}

resource "azurerm_role_assignment" "monitoring_reader" {
  scope                = data.azurerm_subscription.current.id
  role_definition_name = "Monitoring Reader"
  principal_id         = local.app_principal_id
}
