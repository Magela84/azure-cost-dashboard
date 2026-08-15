terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0" # Downloads the Azure connector plug-in
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 3.0" # Downloads the Active Directory plug-in
    }
  }
}

provider "azurerm" {
  features {} # Activates standard Azure management features
}

provider "azuread" {}
