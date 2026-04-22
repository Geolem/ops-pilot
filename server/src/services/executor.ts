import { request as undiciRequest } from "undici";
import { renderRecord, renderTemplate, extractFromResponse, VarScope } from "../lib/template.js";

export interface ExecuteInput {
  method: string;
  baseUrl: string;
  path: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: string;
  bodyType?: "json" | "form" | "text" | "none";
  variables?: VarScope;
  extract?: Record<string, string>;
  timeoutMs?: number;
}

export interface ExecuteResult {
  url: string;
  method: string;
  status: number;
  statusText: string;
  durationMs: number;
  requestHeaders: Record<string, string>;
  requestBody: string | null;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
  responseText: string;
  extracted: Record<string, unknown>;
  error?: string;
}

function joinUrl(baseUrl: string, path: string): string {
  if (!path) return baseUrl;
  if (/^https?:\/\//i.test(path)) return path;
  const base = baseUrl.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

function buildUrl(url: string, query: Record<string, string>): string {
  const entries = Object.entries(query).filter(([, v]) => v !== "" && v != null);
  if (!entries.length) return url;
  const qs = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  return url.includes("?") ? `${url}&${qs}` : `${url}?${qs}`;
}

export async function executeRequest(input: ExecuteInput): Promise<ExecuteResult> {
  const scope = input.variables ?? {};
  const method = (input.method || "GET").toUpperCase();
  const renderedHeaders = renderRecord(input.headers ?? {}, scope);
  const renderedQuery = renderRecord(input.query ?? {}, scope);
  const renderedPath = renderTemplate(input.path ?? "", scope);
  const renderedBaseUrl = renderTemplate(input.baseUrl ?? "", scope);
  const baseUrl = joinUrl(renderedBaseUrl, renderedPath);
  const url = buildUrl(baseUrl, renderedQuery);

  let renderedBody: string | null = null;
  const bodyType = input.bodyType ?? "json";
  if (input.body && bodyType !== "none" && method !== "GET" && method !== "HEAD") {
    renderedBody = renderTemplate(input.body, scope);
    if (bodyType === "json" && !renderedHeaders["Content-Type"] && !renderedHeaders["content-type"]) {
      renderedHeaders["Content-Type"] = "application/json";
    }
    if (bodyType === "form" && !renderedHeaders["Content-Type"] && !renderedHeaders["content-type"]) {
      renderedHeaders["Content-Type"] = "application/x-www-form-urlencoded";
    }
  }

  const start = Date.now();
  try {
    const res = await undiciRequest(url, {
      method: method as any,
      headers: renderedHeaders,
      body: renderedBody ?? undefined,
      headersTimeout: input.timeoutMs ?? 30000,
      bodyTimeout: input.timeoutMs ?? 30000,
    });
    const durationMs = Date.now() - start;
    const text = await res.body.text();
    const responseHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(res.headers)) {
      responseHeaders[k] = Array.isArray(v) ? v.join(", ") : String(v ?? "");
    }
    let responseBody: unknown = text;
    const ct = responseHeaders["content-type"] ?? "";
    if (ct.includes("application/json") || text.startsWith("{") || text.startsWith("[")) {
      try {
        responseBody = JSON.parse(text);
      } catch {
        responseBody = text;
      }
    }
    const extracted = extractFromResponse(input.extract ?? {}, {
      status: res.statusCode,
      body: responseBody,
      headers: responseHeaders,
    });
    return {
      url,
      method,
      status: res.statusCode,
      statusText: "",
      durationMs,
      requestHeaders: renderedHeaders,
      requestBody: renderedBody,
      responseHeaders,
      responseBody,
      responseText: text,
      extracted,
    };
  } catch (err: any) {
    return {
      url,
      method,
      status: 0,
      statusText: "Network Error",
      durationMs: Date.now() - start,
      requestHeaders: renderedHeaders,
      requestBody: renderedBody,
      responseHeaders: {},
      responseBody: null,
      responseText: "",
      extracted: {},
      error: err?.message ?? String(err),
    };
  }
}
