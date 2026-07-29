# Google Cloud & GA4 MCP Server

A full-featured Model Context Protocol (MCP) server for managing Google Cloud Platform resources and pulling Google Analytics 4 (GA4) data. This server allows AI agents (like Claude Desktop or Antigravity) to seamlessly interface with your GCP projects and web analytics.

## Features

This server exposes **33 powerful tools** across 4 domains:

### 1. 📊 Google Analytics 4 (GA4)
Pull comprehensive web analytics for configured sites without leaving your AI environment.
- `ga4_discover_properties`: Probe GA4 property IDs to verify access and metadata.
- `ga4_list_configured_sites`: Show current site-to-property mappings.
- `ga4_set_site_property`: Save a property ID for a specific site.
- `ga4_audience_overview`: Get users, sessions, pageviews, bounce rate, and engagement.
- `ga4_top_pages`: View the highest traffic pages for a site.
- `ga4_traffic_sources`: Break down traffic by channel (organic, direct, referral, etc.).
- `ga4_traffic_over_time`: View trends over days, weeks, or months.
- `ga4_device_breakdown`: Compare desktop, mobile, and tablet usage.
- `ga4_geo_breakdown`: See traffic distributed by country and city.
- `ga4_realtime_users`: Check live active users on the site right now.
- `ga4_compare_all_sites`: Get a quick side-by-side comparison of all configured sites.
- `ga4_run_custom_report`: Run custom queries using any dimensions and metrics.

### 2. 🏗️ GCP Projects Management
- `gcp_list_projects`, `gcp_get_project`
- `gcp_create_project`, `gcp_update_project`, `gcp_delete_project`
- `gcp_get_operation`

### 3. 🔐 Identity and Access Management (IAM)
- **Service Accounts**: `gcp_list_service_accounts`, `gcp_create_service_account`, `gcp_delete_service_account`, `gcp_enable_service_account`, `gcp_disable_service_account`, `gcp_list_service_account_keys`
- **IAM Policies**: `gcp_get_project_iam_policy`, `gcp_add_project_iam_binding`, `gcp_remove_project_iam_binding`, `gcp_list_roles`

### 4. ⚙️ GCP Service APIs
- `gcp_list_apis`, `gcp_enable_apis`, `gcp_disable_api`, `gcp_get_api`, `gcp_get_api_operation`

---

## Configuration

### 1. Service Account Authentication
This server uses a Google Cloud Service Account for authentication.
1. Create a service account in GCP and download the JSON key file.
2. Ensure the service account has the necessary GCP IAM roles (e.g., `Project Creator`, `Security Admin`, etc. depending on which tools you use).
3. To use GA4 tools, you must also add the service account email as a **Viewer** inside your GA4 property's *Property access management* settings.
4. Set the path to your JSON key file using the `GOOGLE_APPLICATION_CREDENTIALS` environment variable when running the server.

### 2. GA4 Sites Configuration
Your site property IDs are stored in `sites.config.json` in the root of this project. 
Currently configured for:
- `crossroadworks.com`
- `alliesprettylittletreats.com`
- `dooratl.church`

You can update these mappings at any time via the AI using the `ga4_set_site_property` tool or by editing the JSON file manually.

---

## Installation & Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/natekpurcella-hue/gcp-mcp.git
   cd gcp-mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the server:
   ```bash
   npm run build
   ```

---

## Connecting to an MCP Client (e.g., Claude Desktop)

To use this server with an MCP client, add it to your client's configuration file.

For **Claude Desktop** on macOS/Linux, edit `~/Library/Application Support/Claude/claude_desktop_config.json` (or the equivalent path for your OS):

```json
{
  "mcpServers": {
    "gcp-mcp": {
      "command": "node",
      "args": [
        "/absolute/path/to/gcp-mcp/dist/index.js"
      ],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/absolute/path/to/your/service-account-key.json"
      }
    }
  }
}
```

Restart your MCP client, and your AI assistant will instantly have access to all GCP and Analytics capabilities!
