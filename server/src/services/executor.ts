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
  preScript?: string;
  postScript?: string;
  timeoutMs?: number;
}

export interface ExecuteResult {
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

function runScript(
  code: string,
  ctx: Record<string, unknown>,
  logs: string[]
): { error?: string } {
  if (!code?.trim()) return {};
  try {
    const console_ = {
      log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
      warn: (...args: unknown[]) => logs.push("[warn] " + args.map(String).join(" ")),
      error: (...args: unknown[]) => logs.push("[error] " + args.map(String).join(" ")),
    };
    const fn = new Function(...Object.keys(ctx), "console", code);
    fn(...Object.values(ctx), console_);
    return {};
  } catch (err: any) {
    return { error: err?.message ?? String(err) };
  }
}

export async function executeRequest(input: ExecuteInput): Promise<ExecuteResult> {
  const scope = (input.variables ?? {}) as Record<string, unknown>;
  const method = (input.method || "GET").toUpperCase();
  const renderedHeaders = renderRecord(input.headers ?? {}, scope);
  const renderedQuery = renderRecord(input.query ?? {}, scope);
  const renderedPath = renderTemplate(input.path ?? "", scope);
  const renderedBaseUrl = renderTemplate(input.baseUrl ?? "", scope);
  const baseUrl = joinUrl(renderedBaseUrl, renderedPath);

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

  const scriptLog: string[] = [];

  // pre-script: may mutate request object (headers, body, query) and vars
  const requestCtx: Record<string, unknown> = {
    method,
    headers: renderedHeaders,
    query: renderedQuery,
    body: renderedBody,
    url: buildUrl(baseUrl, renderedQuery),
  };
  if (input.preScript) {
    const { error } = runScript(input.preScript, { vars: scope, request: requestCtx }, scriptLog);
    if (error) {
      return {
        url: buildUrl(baseUrl, renderedQuery),
        method,
        status: 0,
        durationMs: 0,
        requestHeaders: renderedHeaders,
        requestBody: renderedBody,
        responseHeaders: {},
        responseBody: null,
        responseText: "",
        extracted: {},
        scriptLog,
        error: `preScript error: ${error}`,
      };
    }
    // pick up mutations
    if (requestCtx.body && typeof requestCtx.body === "string") renderedBody = requestCtx.body;
    Object.assign(renderedHeaders, requestCtx.headers ?? {});
    Object.assign(renderedQuery, requestCtx.query ?? {});
  }

  const url = buildUrl(baseUrl, renderedQuery as Record<string, string>);
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
    if (ct.includes("application/json") || text.trimStart().startsWith("{") || text.trimStart().startsWith("[")) {
      try { responseBody = JSON.parse(text); } catch { /* keep text */ }
    }

    const responseCtx = { status: res.statusCode, body: responseBody, headers: responseHeaders };

    // post-script: may mutate vars and inspect response
    if (input.postScript) {
      const { error } = runScript(input.postScript, { vars: scope, response: responseCtx }, scriptLog);
      if (error) scriptLog.push(`postScript error: ${error}`);
    }

    const extracted = extractFromResponse(input.extract ?? {}, responseCtx);
    Object.assign(scope, extracted);

    return {
      url,
      method,
      status: res.statusCode,
      durationMs,
      requestHeaders: renderedHeaders,
      requestBody: renderedBody,
      responseHeaders,
      responseBody,
      responseText: text,
      extracted,
      scriptLog,
    };
  } catch (err: any) {
    return {
      url,
      method,
      status: 0,
      durationMs: Date.now() - start,
      requestHeaders: renderedHeaders,
      requestBody: renderedBody,
      responseHeaders: {},
      responseBody: null,
      responseText: "",
      extracted: {},
      scriptLog,
      error: err?.message ?? String(err),
    };
  }
}
