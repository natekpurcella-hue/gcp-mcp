import { google } from "googleapis";
import { getAuth } from "../auth.js";

function suClient() {
  return google.serviceusage({ version: "v1", auth: getAuth() as never });
}

const projectName = (projectId: string) => `projects/${projectId}`;

export async function listApis(args: { projectId: string; filter?: string; pageSize?: number }): Promise<object> {
  const res = await suClient().services.list({
    parent: projectName(args.projectId),
    filter: args.filter,
    pageSize: args.pageSize ?? 50,
  });
  const services = res.data.services ?? [];
  return {
    services: services.map((s) => ({
      name: s.name,
      title: (s.config as Record<string, unknown>)?.title,
      state: s.state,
    })),
    nextPageToken: res.data.nextPageToken,
  };
}

export async function enableApis(args: { projectId: string; serviceIds: string[] }): Promise<object> {
  const res = await suClient().services.batchEnable({
    parent: projectName(args.projectId),
    requestBody: { serviceIds: args.serviceIds },
  });
  return {
    operation: res.data.name,
    message: `Enabling ${args.serviceIds.join(", ")} on project ${args.projectId}. Operation: ${res.data.name}`,
  };
}

export async function disableApi(args: { projectId: string; serviceName: string }): Promise<object> {
  const name = `${projectName(args.projectId)}/services/${args.serviceName}`;
  const res = await suClient().services.disable({ name, requestBody: { disableDependentServices: false } });
  return {
    operation: res.data.name,
    message: `Disabling ${args.serviceName} on project ${args.projectId}. Operation: ${res.data.name}`,
  };
}

export async function getApi(args: { projectId: string; serviceName: string }): Promise<object> {
  const name = `${projectName(args.projectId)}/services/${args.serviceName}`;
  const res = await suClient().services.get({ name });
  return {
    name: res.data.name,
    state: res.data.state,
    title: (res.data.config as Record<string, unknown>)?.title,
  };
}

export async function getApiOperation(args: { operationName: string }): Promise<object> {
  const res = await suClient().operations.get({ name: args.operationName });
  return res.data;
}
