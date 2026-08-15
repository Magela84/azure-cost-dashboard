# =============================================================
# 1. CORE DATA LOOKUPS (Only look these up ONCE at the top)
# =============================================================

# Look up your target Resource Group folder boundary
data "azurerm_resource_group" "target_group" {
  name = "rg-development-sandbox" # Change to your actual resource group name
}

# Look up the FinOps Specialist's corporate email account
data "azuread_user" "finops_specialist" {
  user_principal_name = "finops.specialist@yourcompany.com" # Change to their work email
}


# =============================================================
# 2. ROLE ASSIGNMENTS (The permissions you are granting)
# =============================================================

# PERMISSION 1: SHUTTING DOWN & RESIZING VMs
resource "azurerm_role_assignment" "vm_shutdown_and_resize" {
  scope                = data.azurerm_resource_group.target_group.id
  role_definition_name = "Virtual Machine Contributor" # Grants stop, start, and resize power
  principal_id         = data.azuread_user.finops_specialist.object_id
}

# PERMISSION 2: DELETING WASTEFUL RESOURCES
resource "azurerm_role_assignment" "delete_wasteful_resources" {
  scope                = data.azurerm_resource_group.target_group.id
  role_definition_name = "Contributor" # Grants full deletion power ONLY inside this sandbox group
  principal_id         = data.azuread_user.finops_specialist.object_id
}
