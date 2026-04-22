import { JSONPath } from "jsonpath-plus";

export type VarScope = Record<string, unknown>;

const TEMPLATE_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

export function renderTemplate(input: string, scope: VarScope): string {
  if (!input) return input;
  return input.replace(TEMPLATE_RE, (_match, rawExpr: string) => {
    const value = resolveExpr(rawExpr.trim(), scope);
    if (value === undefined || value === null) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  });
}

export function renderRecord(
  record: Record<string, string>,
  scope: VarScope
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(record)) {
    const renderedKey = renderTemplate(k, scope);
    out[renderedKey] = renderTemplate(v, scope);
  }
  return out;
}

export function resolveExpr(expr: string, scope: VarScope): unknown {
  if (expr.startsWith("$")) {
    const result = JSONPath({ path: expr, json: scope, wrap: false });
    return result;
  }
  const parts = expr.split(".");
  let current: unknown = scope;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function extractFromResponse(
  extractMap: Record<string, string>,
  response: { status: number; body: unknown; headers: Record<string, string> }
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, path] of Object.entries(extractMap)) {
    out[key] = resolveExpr(path, response);
  }
  return out;
}
