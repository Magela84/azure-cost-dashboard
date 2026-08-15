variable "target_resource_group_name" {
  type        = string
  description = "The name of your real target Azure resource group"
  default     = "rg-development-sandbox" # ◄── Change this to your group name
}

variable "specialist_email" {
  type        = string
  description = "The corporate work email of the FinOps specialist"
  default     = "finops.specialist@yourcompany.com" # ◄── Change this to your user's email
}

variable "vm_management_role" {
  type        = string
  description = "The role used for stopping and resizing wasteful VMs"
  default     = "Virtual Machine Contributor" # ◄── Simply type the new role name here to change it!
}

variable "cleanup_action_role" {
  type        = string
  description = "The role used for permanently deleting dead assets"
  default     = "Contributor" # ◄── Simply type the new role name here to change it!
}
variable "target_resource_group_name" {
  type        = string
  description = "The name of your real target Azure resource group"
  default     = "rg-development-sandbox" # ◄── Change this to your group name
}

variable "specialist_email" {
  type        = string
  description = "The corporate work email of the FinOps specialist"
  default     = "finops.specialist@yourcompany.com" # ◄── Change this to your user's email
}

variable "vm_management_role" {
  type        = string
  description = "The role used for stopping and resizing wasteful VMs"
  default     = "Virtual Machine Contributor" # ◄── Simply type the new role name here to change it!
}

variable "cleanup_action_role" {
  type        = string
  description = "The role used for permanently deleting dead assets"
  default     = "Contributor" # ◄── Simply type the new role name here to change it!
}
