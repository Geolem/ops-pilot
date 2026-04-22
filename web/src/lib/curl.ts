export function buildCurl(input: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string | null;
}): string {
  const parts: string[] = ["curl"];
  parts.push("-X", input.method.toUpperCase());
  for (const [k, v] of Object.entries(input.headers ?? {})) {
    parts.push("-H", shellQuote(`${k}: ${v}`));
  }
  if (input.body) {
    parts.push("--data", shellQuote(input.body));
  }
  parts.push(shellQuote(input.url));
  return parts.join(" \\\n  ");
}

function shellQuote(s: string): string {
  if (!/[^a-zA-Z0-9_\-.\/:@=?&%+]/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
