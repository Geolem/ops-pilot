const BASE = "";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(u: string) => request<T>(u),
  post: <T>(u: string, body?: unknown) =>
    request<T>(u, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(u: string, body?: unknown) =>
    request<T>(u, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(u: string) => request<T>(u, { method: "DELETE" }),
};

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  environments?: Environment[];
  _count?: { endpoints: number; flows: number };
  updatedAt: string;
}

export interface Environment {
  id: string;
  projectId: string;
  name: string;
  baseUrl: string;
  headers: string;
  variables: string;
  updatedAt: string;
}

export interface Endpoint {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  method: string;
  path: string;
  headers: string;
  query: string;
  body: string;
  bodyType: string;
  tags: string;
  extract: string;
  updatedAt: string;
}

export interface Flow {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  nodes: string;
  edges: string;
  updatedAt: string;
}

export interface RunResult {
  url: string;
  method: string;
  status: number;
  durationMs: number;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
  responseText: string;
  extracted: Record<string, unknown>;
  error?: string;
}
