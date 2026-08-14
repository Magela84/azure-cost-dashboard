variable "subscription_id" {
  type        = string
  description = "Azure subscription ID to deploy into (and that the app reads costs from)."
}

variable "location" {
  type        = string
  description = "Azure region for the hosting resources."
  default     = "eastus"
}

variable "name_prefix" {
  type        = string
  description = "Short prefix for resource names (lowercase alphanumeric)."
  default     = "azcostdash"
}

variable "resource_group_to_scan" {
  type        = string
  description = "Resource group the dashboard reads Logic Apps from. Defaults to the RG this stack creates."
  default     = ""
}

variable "container_image" {
  type        = string
  description = "Image name:tag to run (built from the repo's root Dockerfile, pushed to the created ACR)."
  default     = "azure-cost-dashboard:latest"
}

variable "mock_data" {
  type        = string
  description = "\"true\" serves demo data; \"false\" reads real Azure data via the app's managed identity."
  default     = "false"
}

variable "enable_destructive_actions" {
  type        = bool
  description = "Grant the app's identity delete/write rights (Destroy + VM resize) scoped to the scan resource group. Defaults to false — the dashboard is read-only until you opt in."
  default     = false
}

variable "anthropic_api_key" {
  type        = string
  description = "Optional API key for the AI Cost Analyst. Stored in Key Vault, referenced by the app."
  default     = ""
  sensitive   = true
}

variable "auth_user" {
  type        = string
  description = "Optional HTTP Basic Auth username (leave blank to disable auth)."
  default     = ""
}

variable "auth_password" {
  type        = string
  description = "Optional HTTP Basic Auth password. Stored in Key Vault, referenced by the app."
  default     = ""
  sensitive   = true
}

variable "oidc_client_id" {
  type        = string
  description = "Optional Entra ID app registration (application) client ID. Enables OIDC login (overrides Basic Auth) when set together with oidc_client_secret, oidc_tenant_id and oidc_session_secret."
  default     = ""
}

variable "oidc_client_secret" {
  type        = string
  description = "Optional Entra ID client secret for OIDC. Stored in Key Vault, referenced by the app."
  default     = ""
  sensitive   = true
}

variable "oidc_tenant_id" {
  type        = string
  description = "Optional Entra ID directory (tenant) ID used to build the OIDC issuer URL."
  default     = ""
}

variable "oidc_session_secret" {
  type        = string
  description = "Optional secret (>= 16 chars) used to encrypt/sign OIDC session cookies. Stored in Key Vault, referenced by the app."
  default     = ""
  sensitive   = true
}

variable "app_base_url" {
  type        = string
  description = "Public URL of the dashboard (used to build OIDC redirect URIs), e.g. https://dashboard.example.com."
  default     = ""
}

variable "oidc_operator_roles" {
  type        = string
  description = "Comma-separated roles/group IDs allowed to destroy or resize resources. Defaults to 'Operator'."
  default     = "Operator"
}
