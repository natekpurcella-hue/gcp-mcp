import { google } from "googleapis";
import { getAuth } from "../auth.js";

// ─────────────────────────────────────────────────────────────────────────────
// Project tools  (Cloud Resource Manager v3)
// ─────────────────────────────────────────────────────────────────────────────

function crm() {
  return google.cloudresourcemanager({ version: "v3", auth: getAuth() as never });
}

export async function listProjects(args: { filter?: string; pageSize?: number }): Promise<object> {
  const params: Record<string, unknown> = {};
  if (args.filter) params.filter = args.filter;
  if (args.pageSize) params.pageSize = args.pageSize;
  const res = await crm().projects.list(params as never);
  const projects = res.data.projects ?? [];
  return {
    projects: projects.map((p) => ({
      projectId: p.projectId,
      name: p.name,
      displayName: p.displayName,
      state: p.state,
      createTime: p.createTime,
      labels: p.labels ?? {},
    })),
    nextPageToken: res.data.nextPageToken,
  };
}

export async function getProject(args: { projectId: string }): Promise<object> {
  const res = await crm().projects.get({ name: `projects/${args.projectId}` });
  return res.data;
}

export async function createProject(args: {
  projectId: string;
  displayName: string;
  parentId?: string;
  labels?: Record<string, string>;
}): Promise<object> {
  const requestBody: Record<string, unknown> = {
    projectId: args.projectId,
    displayName: args.displayName,
  };
  if (args.labels) requestBody.labels = args.labels;
  if (args.parentId) {
    requestBody.parent = args.parentId.startsWith("folders/")
      ? args.parentId
      : `folders/${args.parentId}`;
  }
  const res = await crm().projects.create({ requestBody } as never);
  return {
    operation: res.data.name,
    message: `Project creation initiated. Operation: ${res.data.name}. Projects can take ~30s to become active.`,
  };
}

export async function updateProject(args: {
  projectId: string;
  displayName?: string;
  labels?: Record<string, string>;
}): Promise<object> {
  const requestBody: Record<string, unknown> = {};
  if (args.displayName) requestBody.displayName = args.displayName;
  if (args.labels) requestBody.labels = args.labels;
  const res = await crm().projects.patch({
    name: `projects/${args.projectId}`,
    requestBody,
    updateMask: Object.keys(requestBody).join(","),
  } as never);
  return res.data;
}

export async function deleteProject(args: { projectId: string }): Promise<object> {
  const res = await crm().projects.delete({ name: `projects/${args.projectId}` });
  return {
    operation: res.data.name,
    message: `Project ${args.projectId} marked for deletion. Recoverable for 30 days.`,
  };
}

export async function getOperation(args: { operationName: string }): Promise<object> {
  const res = await crm().operations.get({ name: args.operationName });
  return res.data;
}
