import { google } from "googleapis";
import { getAuth } from "../auth.js";

// ─────────────────────────────────────────────────────────────────────────────
// IAM (v1) + CRM (v1) using bundled GoogleAuth
// ─────────────────────────────────────────────────────────────────────────────

const auth = () => getAuth() as never;

function iamClient() {
  return google.iam({ version: "v1" as never, auth: auth() });
}

function crmClient() {
  return google.cloudresourcemanager({ version: "v1" as never, auth: auth() });
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Accounts
// ─────────────────────────────────────────────────────────────────────────────

export async function listServiceAccounts(args: { projectId: string }): Promise<object> {
  const res = await (iamClient() as never as {
    projects: { serviceAccounts: { list: (p: { name: string }) => Promise<{ data: { accounts?: unknown[] } }> } };
  }).projects.serviceAccounts.list({ name: `projects/${args.projectId}` });
  const accounts = (res.data.accounts ?? []) as Record<string, unknown>[];
  return {
    serviceAccounts: accounts.map((sa) => ({
      email: sa.email, uniqueId: sa.uniqueId, displayName: sa.displayName,
      description: sa.description, disabled: sa.disabled,
    })),
  };
}

export async function createServiceAccount(args: {
  projectId: string; accountId: string; displayName?: string; description?: string;
}): Promise<object> {
  const res = await (iamClient() as never as {
    projects: { serviceAccounts: { create: (p: unknown) => Promise<{ data: object }> } };
  }).projects.serviceAccounts.create({
    name: `projects/${args.projectId}`,
    requestBody: { accountId: args.accountId, serviceAccount: { displayName: args.displayName, description: args.description } },
  });
  return res.data;
}

export async function deleteServiceAccount(args: { serviceAccountEmail: string; projectId: string }): Promise<object> {
  const name = `projects/${args.projectId}/serviceAccounts/${args.serviceAccountEmail}`;
  await (iamClient() as never as {
    projects: { serviceAccounts: { delete: (p: { name: string }) => Promise<unknown> } };
  }).projects.serviceAccounts.delete({ name });
  return { deleted: true, serviceAccount: args.serviceAccountEmail };
}

export async function enableServiceAccount(args: { serviceAccountEmail: string; projectId: string }): Promise<object> {
  const name = `projects/${args.projectId}/serviceAccounts/${args.serviceAccountEmail}`;
  await (iamClient() as never as {
    projects: { serviceAccounts: { enable: (p: { name: string; requestBody: object }) => Promise<unknown> } };
  }).projects.serviceAccounts.enable({ name, requestBody: {} });
  return { enabled: true, serviceAccount: args.serviceAccountEmail };
}

export async function disableServiceAccount(args: { serviceAccountEmail: string; projectId: string }): Promise<object> {
  const name = `projects/${args.projectId}/serviceAccounts/${args.serviceAccountEmail}`;
  await (iamClient() as never as {
    projects: { serviceAccounts: { disable: (p: { name: string; requestBody: object }) => Promise<unknown> } };
  }).projects.serviceAccounts.disable({ name, requestBody: {} });
  return { disabled: true, serviceAccount: args.serviceAccountEmail };
}

export async function listServiceAccountKeys(args: { serviceAccountEmail: string; projectId: string }): Promise<object> {
  const name = `projects/${args.projectId}/serviceAccounts/${args.serviceAccountEmail}`;
  const res = await (iamClient() as never as {
    projects: { serviceAccounts: { keys: { list: (p: { name: string }) => Promise<{ data: { keys?: unknown[] } }> } } };
  }).projects.serviceAccounts.keys.list({ name });
  return { keys: res.data.keys ?? [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// IAM Policy (project-level, CRM v1)
// ─────────────────────────────────────────────────────────────────────────────

interface IamBinding { role: string; members?: string[] }
interface IamPolicy { bindings?: IamBinding[]; etag?: string; version?: number }
type PolicyClient = {
  projects: {
    getIamPolicy: (p: { resource: string; requestBody: object }) => Promise<{ data: IamPolicy }>;
    setIamPolicy: (p: { resource: string; requestBody: { policy: IamPolicy } }) => Promise<{ data: IamPolicy }>;
  };
};

export async function getProjectIamPolicy(args: { projectId: string }): Promise<object> {
  const res = await (crmClient() as never as PolicyClient).projects.getIamPolicy({
    resource: args.projectId, requestBody: {},
  });
  return res.data;
}

export async function addProjectIamBinding(args: { projectId: string; role: string; member: string }): Promise<object> {
  const c = crmClient() as never as PolicyClient;
  const policyRes = await c.projects.getIamPolicy({ resource: args.projectId, requestBody: {} });
  const policy = policyRes.data;
  const bindings = policy.bindings ?? [];
  const existing = bindings.find((b) => b.role === args.role);
  if (existing) {
    if (!existing.members?.includes(args.member)) existing.members = [...(existing.members ?? []), args.member];
  } else {
    bindings.push({ role: args.role, members: [args.member] });
  }
  policy.bindings = bindings;
  const res = await c.projects.setIamPolicy({ resource: args.projectId, requestBody: { policy } });
  return res.data;
}

export async function removeProjectIamBinding(args: { projectId: string; role: string; member: string }): Promise<object> {
  const c = crmClient() as never as PolicyClient;
  const policyRes = await c.projects.getIamPolicy({ resource: args.projectId, requestBody: {} });
  const policy = policyRes.data;
  for (const binding of policy.bindings ?? []) {
    if (binding.role === args.role) binding.members = (binding.members ?? []).filter((m) => m !== args.member);
  }
  policy.bindings = (policy.bindings ?? []).filter((b) => (b.members?.length ?? 0) > 0);
  const res = await c.projects.setIamPolicy({ resource: args.projectId, requestBody: { policy } });
  return res.data;
}

export async function listRoles(args: { filter?: string; pageSize?: number }): Promise<object> {
  const res = await (iamClient() as never as {
    roles: { list: (p: { view: string; pageSize: number; filter?: string }) => Promise<{ data: { roles?: unknown[]; nextPageToken?: string } }> };
  }).roles.list({ view: "BASIC", pageSize: args.pageSize ?? 50, ...(args.filter ? { filter: args.filter } : {}) });
  const roles = (res.data.roles ?? []) as Record<string, unknown>[];
  return {
    roles: roles.map((r) => ({ name: r.name, title: r.title, description: r.description, stage: r.stage })),
    nextPageToken: res.data.nextPageToken,
  };
}
