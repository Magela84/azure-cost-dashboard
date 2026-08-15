# =============================================================
# 1. CORE DATA LOOKUPS (Linked to your Variables)
# =============================================================

# Look up your target Resource Group folder boundary
data "azurerm_resource_group" "target_group" {
  name = var.target_resource_group_name # Reads from variables.tf
}

# Look up the FinOps Specialist's corporate email account
data "azuread_user" "finops_specialist" {
  user_principal_name = var.specialist_email # Reads from variables.tf
}


# =============================================================
# 2. ROLE ASSIGNMENTS (Linked to your Variables)
# =============================================================

# PERMISSION 1: SHUTTING DOWN & RESIZING VMs
resource "azurerm_role_assignment" "vm_shutdown_and_resize" {
  scope                = data.azurerm_resource_group.target_group.id
  role_definition_name = var.vm_management_role # Reads from variables.tf
  principal_id         = data.azuread_user.finops_specialist.object_id
}

# PERMISSION 2: DELETING WASTEFUL RESOURCES
resource "azurerm_role_assignment" "delete_wasteful_resources" {
  scope                = data.azurerm_resource_group.target_group.id
  role_definition_name = var.cleanup_action_role # Reads from variables.tf
  principal_id         = data.azuread_user.finops_specialist.object_id
}
