# GCP MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that lets AI agents manage Google Cloud Platform — no `gcloud` CLI or Terraform required. It talks directly to GCP REST APIs using a service account.

## Tools Exposed

### 📁 Projects
| Tool | Description |
|---|---|
| `gcp_list_projects` | List all accessible GCP projects |
| `gcp_get_project` | Get details for a specific project |
| `gcp_create_project` | Create a new project |
| `gcp_update_project` | Update a project's display name or labels |
| `gcp_delete_project` | Soft-delete a project (30-day recovery) |
| `gcp_get_operation` | Poll a long-running project operation |

### 🔑 IAM & Service Accounts
| Tool | Description |
|---|---|
| `gcp_list_service_accounts` | List service accounts in a project |
| `gcp_create_service_account` | Create a new service account |
| `gcp_delete_service_account` | Delete a service account |
| `gcp_enable_service_account` | Re-enable a disabled service account |
| `gcp_disable_service_account` | Disable a service account |
| `gcp_list_service_account_keys` | List keys for a service account |
| `gcp_get_project_iam_policy` | Get the project's IAM policy |
| `gcp_add_project_iam_binding` | Grant a role to a member |
| `gcp_remove_project_iam_binding` | Revoke a role from a member |
| `gcp_list_roles` | Browse available IAM roles |

### ⚙️ APIs / Services
| Tool | Description |
|---|---|
| `gcp_list_apis` | List enabled/disabled APIs on a project |
| `gcp_enable_apis` | Enable one or more APIs (batch) |
| `gcp_disable_api` | Disable an API |
| `gcp_get_api` | Check if a specific API is enabled |
| `gcp_get_api_operation` | Poll an API enable/disable operation |

---

## Prerequisites

1. A **Google Cloud service account** with appropriate permissions (see below)
2. A **JSON key file** downloaded for that service account
3. **Node.js 18+**

### Minimum IAM Permissions for the Service Account

| Capability | Required Role |
|---|---|
| List/view projects | `roles/viewer` or `resourcemanager.projects.get` |
| Create projects | `resourcemanager.projects.create` on the org/folder |
| Manage IAM policies | `roles/resourcemanager.projectIamAdmin` |
| Manage service accounts | `roles/iam.serviceAccountAdmin` |
| Enable/disable APIs | `roles/serviceusage.serviceUsageAdmin` |

---

## Setup

### 1. Get a service account key

```bash
# In Google Cloud Console:
# IAM & Admin → Service Accounts → Create → download JSON key
# OR via gcloud (if installed):
gcloud iam service-accounts create gcp-mcp-sa \
  --display-name "GCP MCP Server"

gcloud iam service-accounts keys create key.json \
  --iam-account gcp-mcp-sa@YOUR_PROJECT.iam.gserviceaccount.com
```

### 2. Set environment variable

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/home/nathan/googlemcp/key.json
```

Or copy `.env.example` → `.env` and fill in the path (you'll need to load it yourself or use `dotenv`).

### 3. Build

```bash
npm run build
```

### 4. Test the server starts

```bash
node dist/index.js
# Should print: ✅ GCP MCP Server running on stdio
```

---

## Connecting to an Agent

### Antigravity / Claude Desktop (MCP config)

Add to your MCP settings (e.g. `~/.config/antigravity/mcp.json` or Claude Desktop config):

```json
{
  "mcpServers": {
    "gcp": {
      "command": "node",
      "args": ["/home/nathan/googlemcp/dist/index.js"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/home/nathan/googlemcp/key.json"
      }
    }
  }
}
```

### Generic stdio MCP

The server communicates over **stdin/stdout** using the MCP protocol. Any MCP-compatible client can connect by spawning the process:

```
node /home/nathan/googlemcp/dist/index.js
```

---

## Example Agent Interactions

> **"List all my active GCP projects"**
> → calls `gcp_list_projects` with `filter: "state:ACTIVE"`

> **"Create a new project called my-api-backend"**
> → calls `gcp_create_project` with `projectId: "my-api-backend"`, then `gcp_get_operation` to poll

> **"Enable Cloud Run and Cloud Build on my project"**
> → calls `gcp_enable_apis` with `["run.googleapis.com", "cloudbuild.googleapis.com"]`

> **"Create a deployer service account and give it Cloud Run invoker"**
> → `gcp_create_service_account` → `gcp_add_project_iam_binding` with `roles/run.invoker`

---

## Project Structure

```
googlemcp/
├── src/
│   ├── auth.ts           # Service account token fetcher
│   ├── index.ts          # MCP server entry point (21 tools registered)
│   └── tools/
│       ├── projects.ts   # Project CRUD (CRM v3)
│       ├── iam.ts        # Service accounts + IAM policies
│       └── apis.ts       # API enable/disable (Service Usage v1)
├── dist/                 # Compiled output (after npm run build)
├── tsconfig.json
└── package.json
```
