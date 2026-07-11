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

variable "anthropic_api_key" {
  type        = string
  description = "Optional API key for the AI Cost Analyst."
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
  description = "Optional HTTP Basic Auth password."
  default     = ""
  sensitive   = true
}
