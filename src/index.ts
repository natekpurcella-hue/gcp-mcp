import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

// Tool implementations
import * as projects from "./tools/projects.js";
import * as iam from "./tools/iam.js";
import * as apis from "./tools/apis.js";
import * as analytics from "./tools/analytics.js";

// ─────────────────────────────────────────────────────────────────────────────
// Tool definitions (schema for each tool)
// ─────────────────────────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  // ── Projects ──────────────────────────────────────────────────────────────
  {
    name: "gcp_list_projects",
    description:
      "List all GCP projects accessible by the configured service account. " +
      "Use filter='state:ACTIVE' to see only active projects.",
    inputSchema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          description:
            "Optional filter string. Examples: 'state:ACTIVE', 'labels.env:prod'",
        },
        pageSize: {
          type: "number",
          description: "Maximum number of results to return (default 50).",
        },
      },
      required: [],
    },
  },
  {
    name: "gcp_get_project",
    description: "Get details for a specific GCP project by project ID.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The GCP project ID (e.g. 'my-cool-project').",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "gcp_create_project",
    description:
      "Create a new GCP project. Returns a long-running operation name. " +
      "Use gcp_get_operation to poll for completion.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description:
            "Unique project ID (6-30 chars, lowercase letters, digits, hyphens).",
        },
        displayName: {
          type: "string",
          description: "Human-readable name for the project.",
        },
        parentId: {
          type: "string",
          description:
            "Optional folder or organization ID to nest the project under (e.g. 'folders/123456').",
        },
        labels: {
          type: "object",
          description: "Optional key-value labels to attach to the project.",
          additionalProperties: { type: "string" },
        },
      },
      required: ["projectId", "displayName"],
    },
  },
  {
    name: "gcp_update_project",
    description: "Update a GCP project's display name or labels.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The GCP project ID." },
        displayName: {
          type: "string",
          description: "New display name for the project.",
        },
        labels: {
          type: "object",
          description: "New labels (replaces existing labels).",
          additionalProperties: { type: "string" },
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "gcp_delete_project",
    description:
      "Move a GCP project to DELETE_REQUESTED state. The project is recoverable for 30 days.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "The GCP project ID to delete.",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "gcp_get_operation",
    description:
      "Check the status of a long-running GCP operation (from project creation, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        operationName: {
          type: "string",
          description:
            "The operation name returned by gcp_create_project or gcp_delete_project.",
        },
      },
      required: ["operationName"],
    },
  },

  // ── IAM / Service Accounts ────────────────────────────────────────────────
  {
    name: "gcp_list_service_accounts",
    description: "List all service accounts in a GCP project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The GCP project ID." },
      },
      required: ["projectId"],
    },
  },
  {
    name: "gcp_create_service_account",
    description: "Create a new service account in a GCP project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The GCP project ID." },
        accountId: {
          type: "string",
          description:
            "Unique ID for the service account (6-30 chars, e.g. 'my-deployer').",
        },
        displayName: {
          type: "string",
          description: "Optional human-readable name.",
        },
        description: {
          type: "string",
          description: "Optional description of the service account's purpose.",
        },
      },
      required: ["projectId", "accountId"],
    },
  },
  {
    name: "gcp_delete_service_account",
    description: "Permanently delete a service account.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The GCP project ID." },
        serviceAccountEmail: {
          type: "string",
          description:
            "Full email of the service account (e.g. 'my-sa@my-project.iam.gserviceaccount.com').",
        },
      },
      required: ["projectId", "serviceAccountEmail"],
    },
  },
  {
    name: "gcp_enable_service_account",
    description: "Enable a previously disabled service account.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The GCP project ID." },
        serviceAccountEmail: {
          type: "string",
          description: "Full email of the service account.",
        },
      },
      required: ["projectId", "serviceAccountEmail"],
    },
  },
  {
    name: "gcp_disable_service_account",
    description:
      "Disable a service account (credentials will stop working until re-enabled).",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The GCP project ID." },
        serviceAccountEmail: {
          type: "string",
          description: "Full email of the service account.",
        },
      },
      required: ["projectId", "serviceAccountEmail"],
    },
  },
  {
    name: "gcp_list_service_account_keys",
    description: "List all keys for a service account.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The GCP project ID." },
        serviceAccountEmail: {
          type: "string",
          description: "Full email of the service account.",
        },
      },
      required: ["projectId", "serviceAccountEmail"],
    },
  },
  {
    name: "gcp_get_project_iam_policy",
    description:
      "Get the current IAM policy for a GCP project (shows all role bindings).",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The GCP project ID." },
      },
      required: ["projectId"],
    },
  },
  {
    name: "gcp_add_project_iam_binding",
    description:
      "Grant an IAM role to a member on a GCP project. " +
      "member format: 'user:email', 'serviceAccount:email', 'group:email', 'domain:domain'. " +
      "role format: 'roles/editor', 'roles/viewer', 'roles/iam.serviceAccountUser', etc.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The GCP project ID." },
        role: {
          type: "string",
          description: "IAM role (e.g. 'roles/storage.objectViewer').",
        },
        member: {
          type: "string",
          description:
            "Member to grant the role to (e.g. 'user:alice@example.com').",
        },
      },
      required: ["projectId", "role", "member"],
    },
  },
  {
    name: "gcp_remove_project_iam_binding",
    description: "Remove an IAM role from a member on a GCP project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The GCP project ID." },
        role: { type: "string", description: "IAM role to remove." },
        member: {
          type: "string",
          description: "Member to remove the role from.",
        },
      },
      required: ["projectId", "role", "member"],
    },
  },
  {
    name: "gcp_list_roles",
    description:
      "List available GCP IAM roles. Use filter to narrow results (e.g. 'storage' to find storage roles).",
    inputSchema: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          description:
            "Optional keyword to filter role names (e.g. 'compute', 'storage', 'run').",
        },
        pageSize: {
          type: "number",
          description: "Max results to return (default 50).",
        },
      },
      required: [],
    },
  },

  // ── APIs ──────────────────────────────────────────────────────────────────
  {
    name: "gcp_list_apis",
    description:
      "List APIs/services on a GCP project. Use filter='state:ENABLED' to see only enabled APIs.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The GCP project ID." },
        filter: {
          type: "string",
          description: "Filter string (e.g. 'state:ENABLED' or 'state:DISABLED').",
        },
        pageSize: {
          type: "number",
          description: "Max results to return (default 50).",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "gcp_enable_apis",
    description:
      "Enable one or more GCP APIs on a project. Returns an operation name to poll. " +
      "Common APIs: compute.googleapis.com, run.googleapis.com, " +
      "container.googleapis.com, storage.googleapis.com, " +
      "cloudfunctions.googleapis.com, iam.googleapis.com, " +
      "cloudbuild.googleapis.com, secretmanager.googleapis.com",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The GCP project ID." },
        serviceIds: {
          type: "array",
          items: { type: "string" },
          description:
            "List of API service names to enable (e.g. ['compute.googleapis.com', 'run.googleapis.com']).",
        },
      },
      required: ["projectId", "serviceIds"],
    },
  },
  {
    name: "gcp_disable_api",
    description: "Disable a GCP API on a project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The GCP project ID." },
        serviceName: {
          type: "string",
          description: "API service name to disable (e.g. 'compute.googleapis.com').",
        },
      },
      required: ["projectId", "serviceName"],
    },
  },
  {
    name: "gcp_get_api",
    description: "Get the enabled/disabled state of a specific API on a project.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "The GCP project ID." },
        serviceName: {
          type: "string",
          description: "API service name (e.g. 'compute.googleapis.com').",
        },
      },
      required: ["projectId", "serviceName"],
    },
  },
  {
    name: "gcp_get_api_operation",
    description:
      "Check the status of a long-running API enable/disable operation.",
    inputSchema: {
      type: "object",
      properties: {
        operationName: {
          type: "string",
          description: "The operation name returned by gcp_enable_apis or gcp_disable_api.",
        },
      },
      required: ["operationName"],
    },
  },

  // ── Analytics (GA4) ───────────────────────────────────────────────────────
  {
    name: "ga4_discover_properties",
    description:
      "Probe GA4 property IDs to verify access and retrieve property metadata. " +
      "Pass known property IDs as candidatePropertyIds (find them in GA4 → Admin → Property Settings). " +
      "Also probes any IDs already saved in sites.config.json.",
    inputSchema: {
      type: "object",
      properties: {
        candidatePropertyIds: {
          type: "array",
          items: { type: "string" },
          description: "List of numeric GA4 property IDs to probe (e.g. ['461153501', '479398718']).",
        },
      },
      required: [],
    },
  },
  {
    name: "ga4_list_configured_sites",
    description:
      "Show the configured sites and their GA4 property IDs from sites.config.json.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "ga4_set_site_property",
    description:
      "Save a GA4 property ID for a named site. Call this after ga4_discover_properties " +
      "to link crossroadworks.com, alliesprettylittletreats.com, or dooratl.church to their property IDs.",
    inputSchema: {
      type: "object",
      properties: {
        site: { type: "string", description: "Site name (e.g. 'crossroadworks.com')." },
        propertyId: { type: "string", description: "The numeric GA4 property ID (e.g. '123456789')." },
      },
      required: ["site", "propertyId"],
    },
  },
  {
    name: "ga4_audience_overview",
    description:
      "Get high-level audience metrics for a site: total users, new users, sessions, " +
      "page views, bounce rate, avg session duration, engagement rate.",
    inputSchema: {
      type: "object",
      properties: {
        site: {
          type: "string",
          description: "Site name (e.g. 'crossroadworks.com') or a raw numeric GA4 property ID.",
        },
        startDate: { type: "string", description: "Start date (e.g. '30daysAgo', '2024-01-01'). Defaults to 30daysAgo." },
        endDate: { type: "string", description: "End date (e.g. 'today', '2024-01-31'). Defaults to today." },
      },
      required: ["site"],
    },
  },
  {
    name: "ga4_top_pages",
    description: "Get the top pages by views for a site, with users, avg duration, and bounce rate.",
    inputSchema: {
      type: "object",
      properties: {
        site: { type: "string", description: "Site name or raw GA4 property ID." },
        startDate: { type: "string", description: "Start date. Defaults to 30daysAgo." },
        endDate: { type: "string", description: "End date. Defaults to today." },
        limit: { type: "number", description: "Max pages to return (default 20)." },
      },
      required: ["site"],
    },
  },
  {
    name: "ga4_traffic_sources",
    description:
      "Break down where traffic is coming from: organic search, direct, referral, social, email, etc.",
    inputSchema: {
      type: "object",
      properties: {
        site: { type: "string", description: "Site name or raw GA4 property ID." },
        startDate: { type: "string", description: "Start date. Defaults to 30daysAgo." },
        endDate: { type: "string", description: "End date. Defaults to today." },
      },
      required: ["site"],
    },
  },
  {
    name: "ga4_traffic_over_time",
    description: "Get daily, weekly, or monthly traffic trend (users, sessions, page views) for a site.",
    inputSchema: {
      type: "object",
      properties: {
        site: { type: "string", description: "Site name or raw GA4 property ID." },
        startDate: { type: "string", description: "Start date. Defaults to 30daysAgo." },
        endDate: { type: "string", description: "End date. Defaults to today." },
        dimension: {
          type: "string",
          enum: ["date", "week", "month"],
          description: "Time grouping — 'date' (daily), 'week', or 'month'. Defaults to 'date'.",
        },
      },
      required: ["site"],
    },
  },
  {
    name: "ga4_device_breakdown",
    description: "Break down users by device type (desktop, mobile, tablet) and operating system.",
    inputSchema: {
      type: "object",
      properties: {
        site: { type: "string", description: "Site name or raw GA4 property ID." },
        startDate: { type: "string", description: "Start date. Defaults to 30daysAgo." },
        endDate: { type: "string", description: "End date. Defaults to today." },
      },
      required: ["site"],
    },
  },
  {
    name: "ga4_geo_breakdown",
    description: "Show top countries and cities by users for a site.",
    inputSchema: {
      type: "object",
      properties: {
        site: { type: "string", description: "Site name or raw GA4 property ID." },
        startDate: { type: "string", description: "Start date. Defaults to 30daysAgo." },
        endDate: { type: "string", description: "End date. Defaults to today." },
        limit: { type: "number", description: "Max locations to return (default 20)." },
      },
      required: ["site"],
    },
  },
  {
    name: "ga4_realtime_users",
    description: "Get real-time active users on a site right now (last 30 minutes), broken down by page.",
    inputSchema: {
      type: "object",
      properties: {
        site: { type: "string", description: "Site name or raw GA4 property ID." },
      },
      required: ["site"],
    },
  },
  {
    name: "ga4_compare_all_sites",
    description:
      "Get audience overview metrics for ALL three configured sites at once for a quick side-by-side comparison. " +
      "Sites: crossroadworks.com, alliesprettylittletreats.com, dooratl.church.",
    inputSchema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "Start date. Defaults to 30daysAgo." },
        endDate: { type: "string", description: "End date. Defaults to today." },
      },
      required: [],
    },
  },
  {
    name: "ga4_run_custom_report",
    description:
      "Run a fully custom GA4 report with any dimensions and metrics. " +
      "See https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema for all available names.",
    inputSchema: {
      type: "object",
      properties: {
        site: { type: "string", description: "Site name or raw GA4 property ID." },
        startDate: { type: "string", description: "Start date (e.g. '2024-01-01')." },
        endDate: { type: "string", description: "End date (e.g. '2024-01-31')." },
        dimensions: {
          type: "array",
          items: { type: "string" },
          description: "Dimension names (e.g. ['pagePath', 'deviceCategory']).",
        },
        metrics: {
          type: "array",
          items: { type: "string" },
          description: "Metric names (e.g. ['totalUsers', 'sessions']).",
        },
        limit: { type: "number", description: "Max rows to return (default 50)." },
        orderByMetric: { type: "string", description: "Metric name to sort by descending." },
      },
      required: ["site", "startDate", "endDate", "dimensions", "metrics"],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tool dispatch
// ─────────────────────────────────────────────────────────────────────────────

type AnyArgs = Record<string, unknown>;

async function dispatchTool(name: string, args: AnyArgs): Promise<unknown> {
  switch (name) {
    // Projects
    case "gcp_list_projects":
      return projects.listProjects(args as Parameters<typeof projects.listProjects>[0]);
    case "gcp_get_project":
      return projects.getProject(args as Parameters<typeof projects.getProject>[0]);
    case "gcp_create_project":
      return projects.createProject(args as Parameters<typeof projects.createProject>[0]);
    case "gcp_update_project":
      return projects.updateProject(args as Parameters<typeof projects.updateProject>[0]);
    case "gcp_delete_project":
      return projects.deleteProject(args as Parameters<typeof projects.deleteProject>[0]);
    case "gcp_get_operation":
      return projects.getOperation(args as Parameters<typeof projects.getOperation>[0]);
    // IAM
    case "gcp_list_service_accounts":
      return iam.listServiceAccounts(args as Parameters<typeof iam.listServiceAccounts>[0]);
    case "gcp_create_service_account":
      return iam.createServiceAccount(args as Parameters<typeof iam.createServiceAccount>[0]);
    case "gcp_delete_service_account":
      return iam.deleteServiceAccount(args as Parameters<typeof iam.deleteServiceAccount>[0]);
    case "gcp_enable_service_account":
      return iam.enableServiceAccount(args as Parameters<typeof iam.enableServiceAccount>[0]);
    case "gcp_disable_service_account":
      return iam.disableServiceAccount(args as Parameters<typeof iam.disableServiceAccount>[0]);
    case "gcp_list_service_account_keys":
      return iam.listServiceAccountKeys(args as Parameters<typeof iam.listServiceAccountKeys>[0]);
    case "gcp_get_project_iam_policy":
      return iam.getProjectIamPolicy(args as Parameters<typeof iam.getProjectIamPolicy>[0]);
    case "gcp_add_project_iam_binding":
      return iam.addProjectIamBinding(args as Parameters<typeof iam.addProjectIamBinding>[0]);
    case "gcp_remove_project_iam_binding":
      return iam.removeProjectIamBinding(args as Parameters<typeof iam.removeProjectIamBinding>[0]);
    case "gcp_list_roles":
      return iam.listRoles(args as Parameters<typeof iam.listRoles>[0]);
    // APIs
    case "gcp_list_apis":
      return apis.listApis(args as Parameters<typeof apis.listApis>[0]);
    case "gcp_enable_apis":
      return apis.enableApis(args as Parameters<typeof apis.enableApis>[0]);
    case "gcp_disable_api":
      return apis.disableApi(args as Parameters<typeof apis.disableApi>[0]);
    case "gcp_get_api":
      return apis.getApi(args as Parameters<typeof apis.getApi>[0]);
    case "gcp_get_api_operation":
      return apis.getApiOperation(args as Parameters<typeof apis.getApiOperation>[0]);
    // Analytics
    case "ga4_discover_properties":
      return analytics.discoverProperties(args as never);
    case "ga4_list_configured_sites":
      return analytics.listConfiguredSites(args as never);
    case "ga4_set_site_property":
      return analytics.setSiteProperty(args as Parameters<typeof analytics.setSiteProperty>[0]);
    case "ga4_audience_overview":
      return analytics.audienceOverview(args as Parameters<typeof analytics.audienceOverview>[0]);
    case "ga4_top_pages":
      return analytics.topPages(args as Parameters<typeof analytics.topPages>[0]);
    case "ga4_traffic_sources":
      return analytics.trafficSources(args as Parameters<typeof analytics.trafficSources>[0]);
    case "ga4_traffic_over_time":
      return analytics.trafficOverTime(args as Parameters<typeof analytics.trafficOverTime>[0]);
    case "ga4_device_breakdown":
      return analytics.deviceBreakdown(args as Parameters<typeof analytics.deviceBreakdown>[0]);
    case "ga4_geo_breakdown":
      return analytics.geoBreakdown(args as Parameters<typeof analytics.geoBreakdown>[0]);
    case "ga4_realtime_users":
      return analytics.realtimeUsers(args as Parameters<typeof analytics.realtimeUsers>[0]);
    case "ga4_compare_all_sites":
      return analytics.compareAllSites(args as Parameters<typeof analytics.compareAllSites>[0]);
    case "ga4_run_custom_report":
      return analytics.runCustomReport(args as Parameters<typeof analytics.runCustomReport>[0]);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MCP Server bootstrap
// ─────────────────────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "gcp-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const result = await dispatchTool(name, (args ?? {}) as AnyArgs);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // Surface Google API errors with their HTTP status details
    const detail =
      (err as Record<string, unknown>)?.errors ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((err as Record<string, unknown>)?.response as any)?.data ??
      null;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { error: message, detail },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✅ GCP MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
