output "app_url" {
  description = "URL of the deployed dashboard."
  value       = "https://${azurerm_linux_web_app.app.default_hostname}"
}

output "acr_login_server" {
  description = "Registry to build and push the image to."
  value       = azurerm_container_registry.acr.login_server
}

output "acr_name" {
  description = "ACR name (for `az acr login --name`)."
  value       = azurerm_container_registry.acr.name
}

output "resource_group_name" {
  description = "Resource group holding the hosting resources."
  value       = azurerm_resource_group.main.name
}

output "web_app_name" {
  description = "Web App name (for `az webapp restart`)."
  value       = azurerm_linux_web_app.app.name
}

output "managed_identity_principal_id" {
  description = "Principal ID of the app's managed identity (granted the read roles)."
  value       = azurerm_linux_web_app.app.identity[0].principal_id
}
