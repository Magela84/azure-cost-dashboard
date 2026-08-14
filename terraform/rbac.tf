# Role assignments for the app's managed identity.
#
# Default posture is least privilege and READ-ONLY:
#   - AcrPull                → pull the container image from the registry
#   - Key Vault Secrets User → resolve the KV secret references in app settings
#   - Cost Management Reader → spend & budget queries (subscription scope)
#   - Reader                 → list disks, IPs, snapshots, VMs (idle scan)
#   - Monitoring Reader      → read VM CPU metrics
#
# The Destroy / VM-resize features are DISABLED BY DEFAULT (the app's own
# identity lacks delete/write rights). Only set enable_destructive_actions =
# true if you intend to use them — it grants a custom role scoped to a single
# resource group with only the exact delete/write actions the features need.

data "azurerm_subscription" "current" {}

locals {
  app_principal_id = azurerm_linux_web_app.app.identity[0].principal_id
}

resource "azurerm_role_assignment" "acr_pull" {
  scope                = azurerm_container_registry.acr.id
  role_definition_name = "AcrPull"
  principal_id         = local.app_principal_id
}

resource "azurerm_role_assignment" "key_vault_secrets_user" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets User"
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

# ---------------------------------------------------------------------------
# Optional: the exact delete/write actions the destructive features need, as a
# custom role scoped to the scan resource group only. Granting this is an
# explicit, deliberate act — it stays empty (and unassigned) by default.
# ---------------------------------------------------------------------------
resource "azurerm_role_definition" "cost_dashboard_operator" {
  count = var.enable_destructive_actions ? 1 : 0

  name        = "${var.name_prefix}-resource-operator"
  scope       = "/subscriptions/${data.azurerm_subscription.current.subscription_id}/resourceGroups/${local.scan_rg}"
  description = "Delete/write rights required by the Cost Dashboard destroy and VM-resize features, scoped to the scan resource group."

  permissions {
    actions = [
      "Microsoft.Compute/virtualMachines/delete",
      "Microsoft.Compute/virtualMachines/write",
      "Microsoft.Compute/disks/delete",
      "Microsoft.Compute/snapshots/delete",
      "Microsoft.Network/publicIPAddresses/delete",
    ]
    not_actions = []
  }

  assignable_scopes = [
    "/subscriptions/${data.azurerm_subscription.current.subscription_id}/resourceGroups/${local.scan_rg}",
  ]
}

resource "azurerm_role_assignment" "cost_dashboard_operator" {
  count              = var.enable_destructive_actions ? 1 : 0
  scope              = "/subscriptions/${data.azurerm_subscription.current.subscription_id}/resourceGroups/${local.scan_rg}"
  role_definition_id = azurerm_role_definition.cost_dashboard_operator[0].role_definition_resource_id
  principal_id       = local.app_principal_id
}
