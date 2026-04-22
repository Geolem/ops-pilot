import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Clock, AlertTriangle } from "lucide-react";
import { api, RunResult, Endpoint } from "@/lib/api";
import { statusClass, stringifyPretty } from "@/lib/utils";
import MethodBadge from "./MethodBadge";
import JsonEditor from "./JsonEditor";

export default function RequestRunner({
  endpoint,
  environmentId,
}: {
  endpoint: Endpoint;
  environmentId: string | null;
}) {
  const [result, setResult] = useState<RunResult | null>(null);
  const [tab, setTab] = useState<"body" | "headers" | "extracted" | "request">("body");

  const run = useMutation({
    mutationFn: async () => {
      return api.post<RunResult>("/api/run", {
        endpointId: endpoint.id,
        environmentId: environmentId ?? undefined,
      });
    },
    onSuccess: (r) => setResult(r),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <MethodBadge method={endpoint.method} />
        <span className="font-mono text-sm text-slate-300 truncate flex-1">{endpoint.path}</span>
        <button
          className="btn-primary"
          onClick={() => run.mutate()}
          disabled={run.isPending || !environmentId}
          title={environmentId ? "" : "请先在顶部选择环境"}
        >
          <Play className="w-4 h-4" />
          {run.isPending ? "执行中…" : "执行"}
        </button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-4 space-y-3"
          >
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <span className={`font-semibold ${statusClass(result.status)}`}>
                {result.status || "ERR"}
              </span>
              <span className="text-slate-400 flex items-center gap-1 text-xs">
                <Clock className="w-3 h-3" /> {result.durationMs}ms
              </span>
              <span className="font-mono text-xs text-slate-400 truncate">{result.url}</span>
            </div>

            {result.error && (
              <div className="flex items-start gap-2 text-xs bg-rose-500/10 text-rose-300 rounded-md px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{result.error}</span>
              </div>
            )}

            <div className="flex gap-1 text-xs">
              {(["body", "headers", "extracted", "request"] as const).map((t) => (
                <button
                  key={t}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    tab === t ? "bg-brand/20 text-brand-glow" : "text-slate-400 hover:text-white"
                  }`}
                  onClick={() => setTab(t)}
                >
                  {tabLabel(t)}
                  {t === "extracted" && Object.keys(result.extracted).length > 0 && (
                    <span className="ml-1 text-[10px] text-emerald-300">({Object.keys(result.extracted).length})</span>
                  )}
                </button>
              ))}
            </div>

            <div>
              {tab === "body" && (
                <JsonEditor
                  value={stringifyPretty(result.responseBody)}
                  onChange={() => {}}
                  height={280}
                />
              )}
              {tab === "headers" && (
                <JsonEditor
                  value={stringifyPretty(result.responseHeaders)}
                  onChange={() => {}}
                  height={200}
                />
              )}
              {tab === "extracted" && (
                <JsonEditor
                  value={stringifyPretty(result.extracted)}
                  onChange={() => {}}
                  height={180}
                />
              )}
              {tab === "request" && (
                <div className="space-y-2">
                  <div className="text-xs text-slate-400">Headers</div>
                  <JsonEditor
                    value={stringifyPretty(result.requestHeaders)}
                    onChange={() => {}}
                    height={140}
                  />
                  <div className="text-xs text-slate-400">Body</div>
                  <JsonEditor
                    value={result.requestBody ?? ""}
                    onChange={() => {}}
                    height={140}
                    language={result.requestBody?.trim().startsWith("{") ? "json" : "plaintext"}
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function tabLabel(t: string) {
  switch (t) {
    case "body":
      return "响应体";
    case "headers":
      return "响应头";
    case "extracted":
      return "提取";
    case "request":
      return "请求";
    default:
      return t;
  }
}
