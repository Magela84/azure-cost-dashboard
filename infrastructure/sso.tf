# 1. Register the Application for Web Single Sign-On
resource "azuread_application" "dashboard_sso" {
  display_name     = "azure-cost-dashboard-sso"
  sign_in_audience = "AzureADMyOrg" # Restricts logins to your corporate directory only

  # Configure the Web redirect properties required by your app
  web {
    redirect_uris = [
      "https://onrender.com",
      "http://localhost:3001/api/auth/callback" # Kept for safe local testing
    ]

    implicit_grant {
      id_token_issuance_enabled = true # Activates the secure ID token verification layer
    }
  }

  # Defines the required security clearance scopes for reading user email profiles
  required_resource_access {
    resource_app_id = "00000003-0000-0000-c000-000000000000" # Microsoft Graph API ID

    resource_access {
      id   = "dfa2384e-18c0-409c-a603-3881ee2b1d54" # User.Read profile permission
      type = "Role"
    }
  }
}

# 2. Automatically generate the secure Client Secret (Password)
resource "azuread_application_password" "sso_secret" {
  application_id = azuread_application.dashboard_sso.id
  end_date       = "2027-01-01T00:00:00Z" # Set your enterprise password expiration boundary
}

# =============================================================
# 3. OUTPUT VALUES (Prints your keys on screen when deployed)
# =============================================================
output "sso_client_id" {
  value       = azuread_application.dashboard_sso.client_id
  description = "Paste this value into Render as OIDC_CLIENT_ID"
}

output "sso_client_secret" {
  value       = azuread_application_password.sso_secret.value
  sensitive   = true # Keeps the secret password hidden in standard text logs
}
