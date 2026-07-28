import { google } from "googleapis";
import { getAuth } from "../auth.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITES_CONFIG_PATH = path.resolve(__dirname, "../../sites.config.json");

// ─────────────────────────────────────────────────────────────────────────────
// Type shims (avoid duplicate google-auth-library version conflict)
// ─────────────────────────────────────────────────────────────────────────────

type Row = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};

type ReportResponse = {
  rows?: Row[];
  dimensionHeaders?: Array<{ name?: string }>;
  metricHeaders?: Array<{ name?: string }>;
  rowCount?: number;
};

type RealtimeRow = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};

type RealtimeResponse = { rows?: RealtimeRow[] };

type DataClient = {
  properties: {
    runReport: (p: {
      property: string;
      requestBody: object;
    }) => Promise<{ data: ReportResponse }>;
    runRealtimeReport: (p: {
      property: string;
      requestBody: object;
    }) => Promise<{ data: RealtimeResponse }>;
  };
};

type AdminClient = {
  accounts: {
    list: (p: object) => Promise<{
      data: { accounts?: Array<{ name?: string; displayName?: string }> };
    }>;
  };
  properties: {
    list: (p: { filter: string }) => Promise<{
      data: {
        properties?: Array<{
          name?: string;
          displayName?: string;
          websiteUri?: string;
          createTime?: string;
        }>;
      };
    }>;
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Client factories
// ─────────────────────────────────────────────────────────────────────────────

function dataClient(): DataClient {
  return google.analyticsdata({
    version: "v1beta",
    auth: getAuth() as never,
  }) as never as DataClient;
}

function adminClient(): AdminClient {
  return google.analyticsadmin({
    version: "v1beta",
    auth: getAuth() as never,
  }) as never as AdminClient;
}

// ─────────────────────────────────────────────────────────────────────────────
// Site config helpers
// ─────────────────────────────────────────────────────────────────────────────

function resolveProperty(siteOrPropertyId: string): string {
  if (/^\d+$/.test(siteOrPropertyId)) return siteOrPropertyId;

  const raw = fs.readFileSync(SITES_CONFIG_PATH, "utf-8");
  const config = JSON.parse(raw) as { sites: Record<string, string> };
  const found = config.sites[siteOrPropertyId];
  if (!found) {
    throw new Error(
      `Site "${siteOrPropertyId}" not found in sites.config.json.\n` +
        `Known sites: ${Object.keys(config.sites).join(", ")}\n` +
        `Run ga4_discover_properties to find and save property IDs.`
    );
  }
  if (!found.trim()) {
    throw new Error(
      `Property ID for "${siteOrPropertyId}" is not set in sites.config.json.\n` +
        `Run ga4_discover_properties first, then ga4_set_site_property to configure it.`
    );
  }
  return found;
}

// ─────────────────────────────────────────────────────────────────────────────
// Discovery & config management
// ─────────────────────────────────────────────────────────────────────────────

/** List all GA4 accounts and properties the service account can access. */
/**
 * Discover GA4 properties by probing known property IDs.
 * GA4 property-level Viewer access doesn't allow listing all accounts/properties,
 * so we probe each configured site's property ID (if set) and also accept a list
 * of candidate IDs to check. Returns metadata and access status for each.
 *
 * To add a property manually: call ga4_set_site_property with the site name and ID.
 * Property IDs can be found in GA4 → Admin → Property Settings (top right).
 */
export async function discoverProperties(args: {
  candidatePropertyIds?: string[];
}): Promise<object> {
  const raw = fs.readFileSync(SITES_CONFIG_PATH, "utf-8");
  const config = JSON.parse(raw) as { sites: Record<string, string> };

  // Collect all IDs to probe: configured ones + any extra candidates passed in
  const allIds = new Set<string>();
  for (const id of Object.values(config.sites)) if (id) allIds.add(id);
  for (const id of args.candidatePropertyIds ?? []) allIds.add(id);

  const results: Array<{
    propertyId: string;
    accessible: boolean;
    displayName?: string;
    currencyCode?: string;
    timeZone?: string;
    error?: string;
  }> = [];

  const admin = adminClient();

  for (const propertyId of allIds) {
    try {
      const res = await admin.properties.list({ filter: `parent:properties/${propertyId}` }) as never as {
        data: { properties?: Array<{ name?: string; displayName?: string; currencyCode?: string; timeZone?: string }> }
      };
      // If we can get property metadata, we have access
      const prop = (res.data.properties ?? [])[0];
      results.push({
        propertyId,
        accessible: true,
        displayName: prop?.displayName,
        currencyCode: prop?.currencyCode,
        timeZone: prop?.timeZone,
      });
    } catch {
      // Try an alternate approach: read property directly
      try {
        const propRes = await (admin as never as {
          properties: { get: (p: { name: string }) => Promise<{ data: { displayName?: string; currencyCode?: string; timeZone?: string } }> }
        }).properties.get({ name: `properties/${propertyId}` });
        results.push({
          propertyId,
          accessible: true,
          displayName: propRes.data.displayName,
          currencyCode: propRes.data.currencyCode,
          timeZone: propRes.data.timeZone,
        });
      } catch (err2) {
        results.push({
          propertyId,
          accessible: false,
          error: (err2 as Error).message?.slice(0, 120),
        });
      }
    }
  }

  // Also check sites that have no property ID yet
  const unconfigured = Object.entries(config.sites)
    .filter(([, id]) => !id)
    .map(([site]) => site);

  return {
    probed: results,
    unconfiguredSites: unconfigured.length
      ? unconfigured
      : undefined,
    currentConfig: config.sites,
    instructions:
      unconfigured.length > 0
        ? `To configure missing sites: go to GA4 → Admin → Property Settings, copy the Property ID (number), then call ga4_set_site_property for each site.`
        : "All sites are configured! Use ga4_set_site_property to update any IDs.",
  };
}


/** Save a GA4 property ID for a named site in sites.config.json. */
export async function setSiteProperty(args: {
  site: string;
  propertyId: string;
}): Promise<object> {
  const raw = fs.readFileSync(SITES_CONFIG_PATH, "utf-8");
  const config = JSON.parse(raw) as { sites: Record<string, string> };
  config.sites[args.site] = args.propertyId;
  fs.writeFileSync(SITES_CONFIG_PATH, JSON.stringify(config, null, 2));
  return { saved: true, site: args.site, propertyId: args.propertyId, allSites: config.sites };
}

/** Show all configured sites and their property IDs. */
export async function listConfiguredSites(_args: Record<string, never>): Promise<object> {
  const raw = fs.readFileSync(SITES_CONFIG_PATH, "utf-8");
  const config = JSON.parse(raw) as { sites: Record<string, string> };
  const status = Object.entries(config.sites).map(([site, id]) => ({
    site,
    propertyId: id || "(not set)",
    configured: !!id,
  }));
  return { sites: status };
}

// ─────────────────────────────────────────────────────────────────────────────
// Audience overview
// ─────────────────────────────────────────────────────────────────────────────

export async function audienceOverview(args: {
  site: string;
  startDate?: string;
  endDate?: string;
}): Promise<object> {
  const propertyId = resolveProperty(args.site);
  const client = dataClient();

  const res = await client.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: args.startDate ?? "30daysAgo", endDate: args.endDate ?? "today" }],
      metrics: [
        { name: "totalUsers" },
        { name: "newUsers" },
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
        { name: "engagementRate" },
      ],
    },
  });

  const row = res.data.rows?.[0]?.metricValues ?? [];
  const pct = (v: string | undefined) =>
    v ? `${(parseFloat(v) * 100).toFixed(1)}%` : null;

  return {
    site: args.site,
    propertyId,
    dateRange: { start: args.startDate ?? "30daysAgo", end: args.endDate ?? "today" },
    metrics: {
      totalUsers: row[0]?.value,
      newUsers: row[1]?.value,
      sessions: row[2]?.value,
      pageViews: row[3]?.value,
      bounceRate: pct(row[4]?.value),
      avgSessionDurationSeconds: row[5]?.value ? parseFloat(row[5].value!).toFixed(0) : null,
      engagementRate: pct(row[6]?.value),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Top pages
// ─────────────────────────────────────────────────────────────────────────────

export async function topPages(args: {
  site: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<object> {
  const propertyId = resolveProperty(args.site);
  const client = dataClient();

  const res = await client.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: args.startDate ?? "30daysAgo", endDate: args.endDate ?? "today" }],
      dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
      metrics: [
        { name: "screenPageViews" },
        { name: "totalUsers" },
        { name: "averageSessionDuration" },
        { name: "bounceRate" },
      ],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: args.limit ?? 20,
    },
  });

  const pages = (res.data.rows ?? []).map((row: Row) => ({
    path: row.dimensionValues?.[0]?.value,
    title: row.dimensionValues?.[1]?.value,
    views: row.metricValues?.[0]?.value,
    users: row.metricValues?.[1]?.value,
    avgDurationSecs: row.metricValues?.[2]?.value
      ? parseFloat(row.metricValues[2].value!).toFixed(0)
      : null,
    bounceRate: row.metricValues?.[3]?.value
      ? `${(parseFloat(row.metricValues[3].value!) * 100).toFixed(1)}%`
      : null,
  }));

  return {
    site: args.site,
    propertyId,
    dateRange: { start: args.startDate ?? "30daysAgo", end: args.endDate ?? "today" },
    pages,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Traffic sources
// ─────────────────────────────────────────────────────────────────────────────

export async function trafficSources(args: {
  site: string;
  startDate?: string;
  endDate?: string;
}): Promise<object> {
  const propertyId = resolveProperty(args.site);
  const client = dataClient();

  const res = await client.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: args.startDate ?? "30daysAgo", endDate: args.endDate ?? "today" }],
      dimensions: [
        { name: "sessionDefaultChannelGroup" },
        { name: "sessionSource" },
        { name: "sessionMedium" },
      ],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "screenPageViews" },
        { name: "engagementRate" },
      ],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 25,
    },
  });

  const sources = (res.data.rows ?? []).map((row: Row) => ({
    channelGroup: row.dimensionValues?.[0]?.value,
    source: row.dimensionValues?.[1]?.value,
    medium: row.dimensionValues?.[2]?.value,
    sessions: row.metricValues?.[0]?.value,
    users: row.metricValues?.[1]?.value,
    pageViews: row.metricValues?.[2]?.value,
    engagementRate: row.metricValues?.[3]?.value
      ? `${(parseFloat(row.metricValues[3].value!) * 100).toFixed(1)}%`
      : null,
  }));

  return {
    site: args.site,
    propertyId,
    dateRange: { start: args.startDate ?? "30daysAgo", end: args.endDate ?? "today" },
    sources,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Traffic over time
// ─────────────────────────────────────────────────────────────────────────────

export async function trafficOverTime(args: {
  site: string;
  startDate?: string;
  endDate?: string;
  dimension?: "date" | "week" | "month";
}): Promise<object> {
  const propertyId = resolveProperty(args.site);
  const client = dataClient();
  const dim = args.dimension ?? "date";

  const res = await client.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: args.startDate ?? "30daysAgo", endDate: args.endDate ?? "today" }],
      dimensions: [{ name: dim }],
      metrics: [{ name: "totalUsers" }, { name: "sessions" }, { name: "screenPageViews" }],
      orderBys: [{ dimension: { dimensionName: dim } }],
    },
  });

  return {
    site: args.site,
    propertyId,
    dateRange: { start: args.startDate ?? "30daysAgo", end: args.endDate ?? "today" },
    groupBy: dim,
    data: (res.data.rows ?? []).map((row: Row) => ({
      [dim]: row.dimensionValues?.[0]?.value,
      users: row.metricValues?.[0]?.value,
      sessions: row.metricValues?.[1]?.value,
      pageViews: row.metricValues?.[2]?.value,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Device breakdown
// ─────────────────────────────────────────────────────────────────────────────

export async function deviceBreakdown(args: {
  site: string;
  startDate?: string;
  endDate?: string;
}): Promise<object> {
  const propertyId = resolveProperty(args.site);
  const client = dataClient();

  const res = await client.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: args.startDate ?? "30daysAgo", endDate: args.endDate ?? "today" }],
      dimensions: [{ name: "deviceCategory" }, { name: "operatingSystem" }],
      metrics: [{ name: "totalUsers" }, { name: "sessions" }, { name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
    },
  });

  return {
    site: args.site,
    propertyId,
    dateRange: { start: args.startDate ?? "30daysAgo", end: args.endDate ?? "today" },
    devices: (res.data.rows ?? []).map((row: Row) => ({
      deviceCategory: row.dimensionValues?.[0]?.value,
      operatingSystem: row.dimensionValues?.[1]?.value,
      users: row.metricValues?.[0]?.value,
      sessions: row.metricValues?.[1]?.value,
      pageViews: row.metricValues?.[2]?.value,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Geo breakdown
// ─────────────────────────────────────────────────────────────────────────────

export async function geoBreakdown(args: {
  site: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<object> {
  const propertyId = resolveProperty(args.site);
  const client = dataClient();

  const res = await client.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: args.startDate ?? "30daysAgo", endDate: args.endDate ?? "today" }],
      dimensions: [{ name: "country" }, { name: "city" }],
      metrics: [{ name: "totalUsers" }, { name: "sessions" }],
      orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
      limit: args.limit ?? 20,
    },
  });

  return {
    site: args.site,
    propertyId,
    dateRange: { start: args.startDate ?? "30daysAgo", end: args.endDate ?? "today" },
    locations: (res.data.rows ?? []).map((row: Row) => ({
      country: row.dimensionValues?.[0]?.value,
      city: row.dimensionValues?.[1]?.value,
      users: row.metricValues?.[0]?.value,
      sessions: row.metricValues?.[1]?.value,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Realtime users
// ─────────────────────────────────────────────────────────────────────────────

export async function realtimeUsers(args: { site: string }): Promise<object> {
  const propertyId = resolveProperty(args.site);
  const client = dataClient();

  const res = await client.properties.runRealtimeReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dimensions: [{ name: "unifiedScreenName" }, { name: "deviceCategory" }],
      metrics: [{ name: "activeUsers" }],
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 20,
    },
  });

  const rows = res.data.rows ?? [];
  const totalActive = rows.reduce(
    (sum: number, row: RealtimeRow) =>
      sum + parseInt(row.metricValues?.[0]?.value ?? "0", 10),
    0
  );

  return {
    site: args.site,
    propertyId,
    activeUsersLast30Min: totalActive,
    topPages: rows.map((row: RealtimeRow) => ({
      page: row.dimensionValues?.[0]?.value,
      device: row.dimensionValues?.[1]?.value,
      activeUsers: row.metricValues?.[0]?.value,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Compare all sites
// ─────────────────────────────────────────────────────────────────────────────

export async function compareAllSites(args: {
  startDate?: string;
  endDate?: string;
}): Promise<object> {
  const raw = fs.readFileSync(SITES_CONFIG_PATH, "utf-8");
  const config = JSON.parse(raw) as { sites: Record<string, string> };

  const results = await Promise.all(
    Object.entries(config.sites).map(async ([site, propertyId]) => {
      if (!propertyId) return { site, error: "Property ID not configured" };
      try {
        const client = dataClient();
        const res = await client.properties.runReport({
          property: `properties/${propertyId}`,
          requestBody: {
            dateRanges: [
              { startDate: args.startDate ?? "30daysAgo", endDate: args.endDate ?? "today" },
            ],
            metrics: [
              { name: "totalUsers" },
              { name: "sessions" },
              { name: "screenPageViews" },
              { name: "bounceRate" },
              { name: "engagementRate" },
            ],
          },
        });
        const row = res.data.rows?.[0]?.metricValues ?? [];
        const pct = (v: string | undefined) =>
          v ? `${(parseFloat(v) * 100).toFixed(1)}%` : null;
        return {
          site,
          propertyId,
          totalUsers: row[0]?.value,
          sessions: row[1]?.value,
          pageViews: row[2]?.value,
          bounceRate: pct(row[3]?.value),
          engagementRate: pct(row[4]?.value),
        };
      } catch (err) {
        return { site, error: (err as Error).message };
      }
    })
  );

  return {
    dateRange: { start: args.startDate ?? "30daysAgo", end: args.endDate ?? "today" },
    sites: results,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom report
// ─────────────────────────────────────────────────────────────────────────────

export async function runCustomReport(args: {
  site: string;
  startDate: string;
  endDate: string;
  dimensions: string[];
  metrics: string[];
  limit?: number;
  orderByMetric?: string;
}): Promise<object> {
  const propertyId = resolveProperty(args.site);
  const client = dataClient();

  const res = await client.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: args.startDate, endDate: args.endDate }],
      dimensions: args.dimensions.map((name) => ({ name })),
      metrics: args.metrics.map((name) => ({ name })),
      orderBys: args.orderByMetric
        ? [{ metric: { metricName: args.orderByMetric }, desc: true }]
        : undefined,
      limit: args.limit ?? 50,
    },
  });

  const dimHeaders = (res.data.dimensionHeaders ?? []).map(
    (h: { name?: string }) => h.name
  );
  const metHeaders = (res.data.metricHeaders ?? []).map(
    (h: { name?: string }) => h.name
  );

  const rows = (res.data.rows ?? []).map((row: Row) => {
    const obj: Record<string, string | null | undefined> = {};
    dimHeaders.forEach((d: string | undefined, i: number) => {
      obj[d ?? `dim${i}`] = row.dimensionValues?.[i]?.value;
    });
    metHeaders.forEach((m: string | undefined, i: number) => {
      obj[m ?? `met${i}`] = row.metricValues?.[i]?.value;
    });
    return obj;
  });

  return {
    site: args.site,
    propertyId,
    headers: { dimensions: dimHeaders, metrics: metHeaders },
    rowCount: res.data.rowCount,
    rows,
  };
}
