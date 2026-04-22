export interface ParsedCurl {
  method: string;
  url: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: string;
  bodyType: "json" | "form" | "text" | "none";
}

/** Tokenise a curl command string, respecting single/double quotes. */
function tokenize(s: string): string[] {
  // normalise line continuations
  const cleaned = s.replace(/\\\r?\n\s*/g, " ").trim();
  const tokens: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    while (i < cleaned.length && /\s/.test(cleaned[i])) i++;
    if (i >= cleaned.length) break;
    let cur = "";
    let quote: string | null = null;
    while (i < cleaned.length) {
      const c = cleaned[i];
      if (quote) {
        if (quote === "'" && c === "'") { quote = null; i++; continue; }
        if (quote === '"' && c === '"') { quote = null; i++; continue; }
        if (quote === '"' && c === '\\' && i + 1 < cleaned.length) {
          const next = cleaned[i + 1];
          if (next === '"' || next === '\\' || next === 'n' || next === 't') {
            cur += next === 'n' ? '\n' : next === 't' ? '\t' : next;
            i += 2; continue;
          }
        }
        cur += c; i++;
      } else {
        if (c === '"' || c === "'") { quote = c; i++; continue; }
        if (/\s/.test(c)) break;
        cur += c; i++;
      }
    }
    if (cur) tokens.push(cur);
  }
  return tokens;
}

function splitUrl(raw: string): { base: string; query: Record<string, string> } {
  const q = raw.indexOf("?");
  if (q === -1) return { base: raw, query: {} };
  const base = raw.slice(0, q);
  const query: Record<string, string> = {};
  for (const part of raw.slice(q + 1).split("&")) {
    const eq = part.indexOf("=");
    if (eq === -1) { query[decodeURIComponent(part)] = ""; continue; }
    query[decodeURIComponent(part.slice(0, eq))] = decodeURIComponent(part.slice(eq + 1));
  }
  return { base, query };
}

export function parseCurl(input: string): ParsedCurl {
  const tokens = tokenize(input.trim());
  if (!tokens.length || tokens[0].toLowerCase() !== "curl") {
    throw new Error('命令必须以 "curl" 开头');
  }

  let method: string | null = null;
  let rawUrl: string | null = null;
  const headers: Record<string, string> = {};
  const dataParts: string[] = [];   // accumulates every --data / -d value
  const formParts: string[] = [];   // accumulates --data-urlencode / -F values
  let bodyType: "json" | "form" | "text" | "none" = "none";

  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i];
    const peek = () => tokens[++i] ?? "";

    if (tok === "-X" || tok === "--request") {
      method = peek().toUpperCase();
    } else if (tok === "-H" || tok === "--header") {
      const h = peek();
      const colon = h.indexOf(":");
      if (colon > 0) headers[h.slice(0, colon).trim()] = h.slice(colon + 1).trim();
    } else if (tok === "-d" || tok === "--data" || tok === "--data-raw" || tok === "--data-binary" || tok === "--data-ascii") {
      dataParts.push(peek());
      if (!method) method = "POST";
    } else if (tok === "--data-urlencode") {
      formParts.push(peek());
      if (!method) method = "POST";
    } else if (tok === "-F" || tok === "--form") {
      formParts.push(peek());
      if (!method) method = "POST";
    } else if (tok === "--url") {
      rawUrl = peek();
    } else if (tok === "-u" || tok === "--user") {
      const cred = peek();
      if (cred) {
        try {
          headers["Authorization"] = "Basic " + btoa(cred);
        } catch {
          headers["Authorization"] = "Basic " + cred;
        }
      }
    } else if (tok === "-b" || tok === "--cookie") {
      headers["Cookie"] = peek();
    } else if (tok === "-A" || tok === "--user-agent") {
      headers["User-Agent"] = peek();
    } else if (tok === "--compressed") {
      headers["Accept-Encoding"] = "gzip, deflate, br";
    } else if (tok === "-k" || tok === "--insecure" || tok === "-s" || tok === "--silent"
      || tok === "-v" || tok === "--verbose" || tok === "-i" || tok === "--include"
      || tok === "-L" || tok === "--location") {
      // no-arg flags – skip
    } else if (tok.startsWith("-")) {
      // unknown flag – try to skip one value if next doesn't start with -
      if (i + 1 < tokens.length && !tokens[i + 1].startsWith("-")) i++;
    } else if (!rawUrl) {
      rawUrl = tok;
    }
  }

  if (!rawUrl) throw new Error("未找到 URL");

  // Resolve body & bodyType from accumulated parts
  let body = "";
  if (formParts.length) {
    // --data-urlencode / -F always form
    body = [...dataParts, ...formParts].join("&");
    bodyType = "form";
  } else if (dataParts.length === 1) {
    const d = dataParts[0];
    const trimmed = d.trimStart();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      body = d;
      bodyType = "json";
    } else {
      // single --data with key=value → still form
      body = d;
      bodyType = d.includes("=") ? "form" : "text";
    }
  } else if (dataParts.length > 1) {
    // multiple --data flags → join as form body
    body = dataParts.join("&");
    bodyType = "form";
  }

  const { base, query } = splitUrl(rawUrl);

  return {
    method: method ?? (body ? "POST" : "GET"),
    url: base,
    headers,
    query,
    body,
    bodyType,
  };
}
