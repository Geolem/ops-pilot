import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function methodClass(method: string) {
  const m = method.toUpperCase();
  return `method-${m}`;
}

export function statusClass(status?: number | null) {
  if (!status) return "status-0";
  if (status >= 500) return "status-5xx";
  if (status >= 400) return "status-4xx";
  if (status >= 300) return "status-3xx";
  return "status-2xx";
}

export function safeJson(raw: string | null | undefined, fallback: unknown = {}) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function stringifyPretty(v: unknown) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
