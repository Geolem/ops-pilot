const BASE = "";
const REQUEST_TIMEOUT_MS = 30000;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const hasBody = !!init?.body;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE}${url}`, {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: {
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error("请求超时，请稍后重试");
    }
    throw err;
  } finally {
    window.clearTimeout(timeout);
  }
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    let msg = text;
    try {
      const data = JSON.parse(text);
      msg = data.error ?? data.message ?? text;
    } catch { /* not JSON, keep raw text */ }
    throw new Error(msg || `HTTP ${res.status}`);
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
  preScript: string;
  postScript: string;
  starred: boolean;
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
  scriptLog: string[];
  error?: string;
}
