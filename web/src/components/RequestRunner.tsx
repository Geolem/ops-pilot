import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Clock, AlertTriangle, Terminal, Maximize2, RefreshCw, ChevronRight, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { api, RunResult, Endpoint } from "@/lib/api";
import { statusClass, stringifyPretty } from "@/lib/utils";
import MethodBadge from "./MethodBadge";
import JsonEditor from "./JsonEditor";
import Modal from "./Modal";

type Tab = "body" | "table" | "headers" | "extracted" | "request" | "log";

// BFS through the JSON tree to find the first non-empty array of objects,
// regardless of key name, casing, or nesting depth (max 6 levels).
function resolveArray(body: unknown): Record<string, unknown>[] | null {
  const isObjArray = (v: unknown): v is Record<string, unknown>[] =>
    Array.isArray(v) && v.length > 0 && v.every((x) => x !== null && typeof x === "object" && !Array.isArray(x));

  if (isObjArray(body)) return body;

  const queue: { node: unknown; depth: number }[] = [{ node: body, depth: 0 }];
  while (queue.length) {
    const { node, depth } = queue.shift()!;
    if (!node || typeof node !== "object" || Array.isArray(node) || depth > 6) continue;
    for (const val of Object.values(node as object)) {
      if (isObjArray(val)) return val as Record<string, unknown>[];
      if (val && typeof val === "object" && !Array.isArray(val)) {
        queue.push({ node: val, depth: depth + 1 });
      }
    }
  }
  return null;
}

type FieldMap = { from: string; to: string; enabled: boolean };

function CopyChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="inline-flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.5 rounded bg-brand/15 text-brand-glow hover:bg-brand/25 transition-colors"
      title="点击复制"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
      {text}
    </button>
  );
}

function TableView({
  rows,
  projectId,
  environmentId,
  onRefresh,
}: {
  rows: Record<string, unknown>[];
  projectId?: string | null;
  environmentId: string | null;
  onRefresh: () => void;
}) {
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r)))).slice(0, 12);
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null);
  const [mapping, setMapping] = useState<FieldMap[]>([]);
  const [actionEpId, setActionEpId] = useState("");
  const [actionResult, setActionResult] = useState<RunResult | null>(null);

  // Re-init mapping whenever a new row is selected
  useEffect(() => {
    if (!selectedRow) { setMapping([]); return; }
    setMapping(
      Object.keys(selectedRow).map((k) => ({ from: k, to: k, enabled: true }))
    );
    setActionResult(null);
  }, [selectedRow]);

  const { data: endpoints = [] } = useQuery({
    queryKey: ["endpoints", projectId],
    queryFn: () =>
      projectId
        ? api.get<Endpoint[]>(`/api/endpoints?projectId=${projectId}`)
        : Promise.resolve([]),
    enabled: !!projectId,
  });

  const extraVariables = Object.fromEntries(
    mapping
      .filter((m) => m.enabled && m.to.trim())
      .map((m) => [m.to.trim(), selectedRow?.[m.from]])
  );

  const runAction = useMutation({
    mutationFn: () =>
      api.post<RunResult>("/api/run", {
        endpointId: actionEpId,
        environmentId: environmentId ?? undefined,
        extraVariables,
      }),
    onSuccess: (r) => {
      setActionResult(r);
      toast.success(`执行完成 · HTTP ${r.status}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fmt = (v: unknown): string => {
    if (v === null || v === undefined) return "—";
    if (typeof v === "object") return JSON.stringify(v).slice(0, 80);
    return String(v);
  };

  const updateMapping = (i: number, patch: Partial<FieldMap>) =>
    setMapping((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{rows.length} 条记录，点击行配置参数并执行下一个接口</span>
        <button className="btn-ghost text-xs py-1" onClick={onRefresh}>
          <RefreshCw className="w-3 h-3" /> 刷新列表
        </button>
      </div>

      {/* Data table */}
      <div className="overflow-auto max-h-64 rounded-lg border border-white/5">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-bg-panel">
            <tr>
              {cols.map((c) => (
                <th key={c} className="text-left px-3 py-2 text-slate-400 font-medium border-b border-white/5 whitespace-nowrap">
                  {c}
                </th>
              ))}
              <th className="px-3 py-2 border-b border-white/5 w-6" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-white/5 hover:bg-bg-hover/40 cursor-pointer transition-colors ${
                  selectedRow === row ? "bg-brand/10 ring-1 ring-inset ring-brand/30" : ""
                }`}
                onClick={() => setSelectedRow(row === selectedRow ? null : row)}
              >
                {cols.map((c) => (
                  <td key={c} className="px-3 py-2 font-mono text-slate-300 whitespace-nowrap max-w-[200px] truncate">
                    {fmt(row[c])}
                  </td>
                ))}
                <td className="px-3 py-2 text-slate-500">
                  <ChevronRight className={`w-3 h-3 transition-transform ${selectedRow === row ? "rotate-90 text-brand-glow" : ""}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Row action panel */}
      <AnimatePresence>
        {selectedRow && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-lg border border-brand/30 bg-brand/5 p-4 space-y-4">

              {/* Field → variable mapping */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">字段 → 变量映射</span>
                  <span className="text-[11px] text-slate-500">在接口路径 / 参数 / Body 中用 <span className="font-mono text-brand-glow">{"{{变量名}}"}</span> 引用</span>
                </div>

                <div className="rounded-md border border-white/5 overflow-hidden">
                  {/* header */}
                  <div className="grid grid-cols-[20px_1fr_28px_1fr_1fr] gap-2 px-3 py-1.5 bg-bg-elevated/60 text-[11px] text-slate-500 font-medium">
                    <span />
                    <span>行字段</span>
                    <span />
                    <span>变量名</span>
                    <span>当前值</span>
                  </div>
                  <div className="max-h-44 overflow-auto divide-y divide-white/5">
                    {mapping.map((m, i) => (
                      <div key={m.from} className={`grid grid-cols-[20px_1fr_28px_1fr_1fr] gap-2 px-3 py-2 items-center text-xs ${!m.enabled ? "opacity-40" : ""}`}>
                        <input
                          type="checkbox"
                          checked={m.enabled}
                          onChange={(e) => updateMapping(i, { enabled: e.target.checked })}
                          className="accent-brand cursor-pointer"
                        />
                        <span className="font-mono text-slate-300 truncate" title={m.from}>{m.from}</span>
                        <span className="text-slate-500 text-center">→</span>
                        <input
                          className="input py-0.5 px-2 text-xs font-mono h-7"
                          value={m.to}
                          onChange={(e) => updateMapping(i, { to: e.target.value })}
                          disabled={!m.enabled}
                          placeholder="变量名"
                        />
                        <span className="font-mono text-slate-400 truncate text-[11px]" title={fmt(selectedRow[m.from])}>
                          {fmt(selectedRow[m.from])}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Copyable chips for enabled mappings */}
                {mapping.filter((m) => m.enabled && m.to.trim()).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[11px] text-slate-500">点击复制：</span>
                    {mapping
                      .filter((m) => m.enabled && m.to.trim())
                      .map((m) => (
                        <CopyChip key={m.from} text={`{{${m.to.trim()}}}`} />
                      ))}
                  </div>
                )}
              </div>

              {/* Endpoint selector + run */}
              <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-white/5">
                <select
                  className="input py-1.5 text-xs flex-1 min-w-[200px]"
                  value={actionEpId}
                  onChange={(e) => { setActionEpId(e.target.value); setActionResult(null); }}
                >
                  <option value="">选择要执行的接口…</option>
                  {endpoints.map((ep) => (
                    <option key={ep.id} value={ep.id}>[{ep.method}] {ep.name}</option>
                  ))}
                </select>
                <button
                  className="btn-primary py-1.5 text-xs"
                  disabled={!actionEpId || !environmentId || runAction.isPending}
                  onClick={() => runAction.mutate()}
                >
                  <Play className="w-3 h-3" />
                  {runAction.isPending ? "执行中…" : "执行"}
                </button>
              </div>

              {actionResult && (
                <div className={`text-xs rounded-md px-3 py-2 font-mono ${statusClass(actionResult.status)} bg-bg-elevated/60 space-y-0.5`}>
                  <div>HTTP {actionResult.status} · {actionResult.durationMs}ms</div>
                  {actionResult.error && <div className="text-rose-300">{actionResult.error}</div>}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function RequestRunner({
  endpoint,
  environmentId,
  projectId,
}: {
  endpoint: Endpoint;
  environmentId: string | null;
  projectId?: string | null;
}) {
  const [result, setResult] = useState<RunResult | null>(null);
  const [tab, setTab] = useState<Tab>("body");
  const [expandOpen, setExpandOpen] = useState(false);

  const rows = result ? resolveArray(result.responseBody) : null;

  const run = useMutation({
    mutationFn: () =>
      api.post<RunResult>("/api/run", {
        endpointId: endpoint.id,
        environmentId: environmentId ?? undefined,
      }),
    onSuccess: (r) => {
      setResult(r);
      setTab(resolveArray(r.responseBody) ? "table" : "body");
    },
  });

  const tabs: { key: Tab; label: string; badge?: number | string; hidden?: boolean }[] = [
    { key: "body", label: "响应体" },
    { key: "table", label: "表格", hidden: !rows },
    { key: "headers", label: "响应头" },
    { key: "extracted", label: "提取", badge: result ? Object.keys(result.extracted).length || undefined : undefined },
    { key: "request", label: "请求" },
    { key: "log", label: "脚本日志", badge: result?.scriptLog?.length || undefined },
  ];

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
              <span className="font-mono text-xs text-slate-400 truncate flex-1">{result.url}</span>
              <button
                className="btn-ghost p-1.5 text-xs"
                onClick={() => run.mutate()}
                disabled={run.isPending}
                title="重新执行"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {result.error && (
              <div className="flex items-start gap-2 text-xs bg-rose-500/10 text-rose-300 rounded-md px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                {result.error}
              </div>
            )}

            <div className="flex items-center justify-between gap-1 flex-wrap">
              <div className="flex gap-1 text-xs flex-wrap">
                {tabs.filter((t) => !t.hidden).map(({ key, label, badge }) => (
                  <button
                    key={key}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      tab === key ? "bg-brand/20 text-brand-glow" : "text-slate-400 hover:text-white"
                    }`}
                    onClick={() => setTab(key)}
                  >
                    {label}
                    {badge ? <span className="ml-1 text-[10px] text-emerald-300">({badge})</span> : null}
                  </button>
                ))}
              </div>
              {(tab === "body" || tab === "headers") && (
                <button
                  className="btn-ghost p-1.5"
                  title="放大查看"
                  onClick={() => setExpandOpen(true)}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div>
              {tab === "body" && (
                <JsonEditor value={stringifyPretty(result.responseBody)} onChange={() => {}} height={280} />
              )}
              {tab === "table" && rows && (
                <TableView
                  rows={rows}
                  projectId={projectId}
                  environmentId={environmentId}
                  onRefresh={() => run.mutate()}
                />
              )}
              {tab === "headers" && (
                <JsonEditor value={stringifyPretty(result.responseHeaders)} onChange={() => {}} height={200} />
              )}
              {tab === "extracted" && (
                <JsonEditor value={stringifyPretty(result.extracted)} onChange={() => {}} height={180} />
              )}
              {tab === "request" && (
                <div className="space-y-2">
                  <div className="text-xs text-slate-400">Headers</div>
                  <JsonEditor value={stringifyPretty(result.requestHeaders)} onChange={() => {}} height={140} />
                  <div className="text-xs text-slate-400">Body</div>
                  <JsonEditor
                    value={result.requestBody ?? ""}
                    onChange={() => {}}
                    height={140}
                    language={result.requestBody?.trim().startsWith("{") ? "json" : "plaintext"}
                  />
                </div>
              )}
              {tab === "log" && (
                <div className="bg-bg-elevated/40 rounded-lg p-3 font-mono text-xs text-slate-300 space-y-0.5 max-h-48 overflow-auto">
                  {result.scriptLog?.length ? (
                    result.scriptLog.map((line, i) => <div key={i}>{line}</div>)
                  ) : (
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5" /> 无脚本输出
                    </span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen expand modal */}
      <Modal open={expandOpen} onClose={() => setExpandOpen(false)} title="响应详情" width="max-w-5xl">
        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <span className={`font-semibold ${statusClass(result.status)}`}>{result.status || "ERR"}</span>
              <span className="text-slate-400 text-xs flex items-center gap-1"><Clock className="w-3 h-3" />{result.durationMs}ms</span>
              <span className="font-mono text-xs text-slate-400 truncate">{result.url}</span>
            </div>
            <div className="flex gap-1 text-xs mb-2">
              {(["body", "headers"] as const).map((k) => (
                <button
                  key={k}
                  className={`px-2.5 py-1 rounded-md ${tab === k ? "bg-brand/20 text-brand-glow" : "text-slate-400 hover:text-white"}`}
                  onClick={() => setTab(k)}
                >
                  {k === "body" ? "响应体" : "响应头"}
                </button>
              ))}
            </div>
            <JsonEditor
              value={tab === "body" ? stringifyPretty(result.responseBody) : stringifyPretty(result.responseHeaders)}
              onChange={() => {}}
              height={520}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
