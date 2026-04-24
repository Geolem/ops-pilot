import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Clock, AlertTriangle, RefreshCw, ChevronRight, Copy, Check, Eye, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { api, RunResult, Endpoint, Environment } from "@/lib/api";
import { useAppStore } from "@/store/app";
import { useShortcut } from "@/hooks/useShortcut";
import { statusClass, stringifyPretty, safeJson } from "@/lib/utils";

/** Maps status → CSS class for the new status-badge pill */
function statusBadgeClass(status?: number | null) {
  if (!status) return "status-badge-0";
  if (status >= 500) return "status-badge-5xx";
  if (status >= 400) return "status-badge-4xx";
  if (status >= 300) return "status-badge-3xx";
  return "status-badge-2xx";
}
import MethodBadge from "./MethodBadge";
import JsonEditor from "./JsonEditor";
import Select from "./Select";

// ─── ResultPanel ──────────────────────────────────────────────────────────────
// Reusable result display with tabs — used by both the main runner and TableView

type ResultTab = "body" | "headers" | "extracted";

export function ResultPanel({ result, compact = false }: { result: RunResult; compact?: boolean }) {
  const [tab, setTab] = useState<ResultTab>("body");
  const [fullscreen, setFullscreen] = useState(false);
  const hasExtracted = Object.keys(result.extracted ?? {}).length > 0;

  const tabItems: { key: ResultTab; label: string }[] = [
    { key: "body", label: "响应体" },
    { key: "headers", label: "响应头" },
    ...(hasExtracted ? [{ key: "extracted" as ResultTab, label: "提取变量" }] : []),
  ];

  const bodyHeight = compact ? 200 : 280;
  const headersHeight = compact ? 160 : 200;

  const TabBar = ({ className = "" }: { className?: string }) => (
    <div className={`flex gap-0.5 flex-wrap ${className}`}>
      {tabItems.map(({ key, label }) => (
        <button
          key={key}
          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
            tab === key
              ? "bg-brand/20 text-brand dark:text-brand-glow ring-1 ring-brand/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
          }`}
          onClick={() => setTab(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div className="space-y-2.5">
        {/* Status row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`status-badge ${statusBadgeClass(result.status)}`}>
            {result.status || "ERR"}
          </span>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {result.durationMs}ms
          </span>
          {result.url && (
            <span className="font-mono text-[11px] text-slate-500 truncate flex-1 min-w-0 hidden sm:block" title={result.url}>
              {result.url}
            </span>
          )}
          {result.error && (
            <span className="text-xs text-rose-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0" />{result.error}
            </span>
          )}
          <button
            className="ml-auto btn-ghost p-1"
            onClick={() => setFullscreen(true)}
            title="全屏查看"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tab bar */}
        <TabBar />

        {/* Content */}
        {tab === "body" && (
          <JsonEditor value={stringifyPretty(result.responseBody)} onChange={() => {}} height={bodyHeight} />
        )}
        {tab === "headers" && (
          <JsonEditor value={stringifyPretty(result.responseHeaders)} onChange={() => {}} height={headersHeight} />
        )}
        {tab === "extracted" && (
          <JsonEditor value={stringifyPretty(result.extracted)} onChange={() => {}} height={160} />
        )}
      </div>

      {/* Fullscreen modal */}
      <Modal open={fullscreen} onClose={() => setFullscreen(false)} title={`响应 · ${result.status || "ERR"} · ${result.durationMs}ms`} width="max-w-5xl">
        <div className="space-y-3">
          <TabBar />
          {tab === "body" && (
            <JsonEditor value={stringifyPretty(result.responseBody)} onChange={() => {}} height={580} />
          )}
          {tab === "headers" && (
            <JsonEditor value={stringifyPretty(result.responseHeaders)} onChange={() => {}} height={580} />
          )}
          {tab === "extracted" && (
            <JsonEditor value={stringifyPretty(result.extracted)} onChange={() => {}} height={580} />
          )}
        </div>
      </Modal>
    </>
  );
}
import Modal from "./Modal";

type Tab = "body" | "table" | "headers" | "extracted" | "request" | "log";

// ─── Variable substitution preview ────────────────────────────────────────────

function buildPreviewUrl(
  endpoint: Endpoint,
  env: Environment | null
): { url: string; unresolved: string[] } {
  const vars = safeJson(env?.variables ?? "{}", {}) as Record<string, string>;
  const baseUrl = (env?.baseUrl ?? "").replace(/\/$/, "");
  const unresolved: string[] = [];

  const sub = (s: string) =>
    s.replace(/\{\{([\w.]+)\}\}/g, (_, k) => {
      if (k in vars) return String(vars[k]);
      unresolved.push(k);
      return `{{${k}}}`;
    });

  const rawPath = sub(endpoint.path);
  const fullPath = rawPath.startsWith("http") ? rawPath : `${baseUrl}${rawPath}`;

  const query = safeJson(endpoint.query, {}) as Record<string, string>;
  const qparts = Object.entries(query)
    .filter(([k]) => k.trim())
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(sub(v))}`);

  const url = qparts.length > 0 ? `${fullPath}?${qparts.join("&")}` : fullPath;
  return { url, unresolved: [...new Set(unresolved)] };
}

/** Render a URL string, highlighting unresolved {{var}} in amber. */
function PreviewUrl({ url, unresolved }: { url: string; unresolved: string[] }) {
  const parts = url.split(/(\{\{[\w.]+\}\})/g);
  return (
    <span className="font-mono text-[11px] truncate text-slate-400" title={url}>
      {parts.map((part, i) =>
        /^\{\{/.test(part) ? (
          <span key={i} className="text-amber-400 font-semibold">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

// ─── BFS resolver for table data ──────────────────────────────────────────────

export function resolveArray(body: unknown): Record<string, unknown>[] | null {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── TableView ────────────────────────────────────────────────────────────────

export function TableView({
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
  const [tableExpanded, setTableExpanded] = useState(false);
  const mappingRef = useRef<HTMLDivElement>(null);

  // Default all fields to unchecked; user picks what to forward
  useEffect(() => {
    if (!selectedRow) { setMapping([]); return; }
    setMapping(Object.keys(selectedRow).map((k) => ({ from: k, to: k, enabled: false })));
    setActionResult(null);
    // Auto-scroll mapping panel into view after animation starts
    setTimeout(() => {
      mappingRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
  }, [selectedRow]);

  const { data: endpoints = [] } = useQuery({
    queryKey: ["endpoints", projectId],
    queryFn: () =>
      projectId ? api.get<Endpoint[]>(`/api/endpoints?projectId=${projectId}`) : Promise.resolve([]),
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
        <span className="text-xs text-slate-400">{rows.length} 条记录，点击行选择并配置参数</span>
        <div className="flex items-center gap-1">
          <button
            className="btn-ghost text-xs py-1"
            onClick={() => setTableExpanded((v) => !v)}
            title={tableExpanded ? "收起表格" : "展开表格"}
          >
            <Maximize2 className="w-3 h-3" /> {tableExpanded ? "收起" : "展开"}
          </button>
          <button className="btn-ghost text-xs py-1" onClick={onRefresh}>
            <RefreshCw className="w-3 h-3" /> 刷新
          </button>
        </div>
      </div>

      {/* Data table */}
      <div className={`overflow-auto rounded-lg border border-white/5 transition-all duration-200 ${tableExpanded ? "max-h-[65vh]" : "max-h-48 md:max-h-64"}`}>
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-bg-panel">
            <tr>
              {cols.map((c) => (
                <th key={c} className="text-left px-3 py-2 text-slate-400 font-medium border-b border-white/5 whitespace-nowrap">{c}</th>
              ))}
              <th className="px-3 py-2 border-b border-white/5 w-6" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={`cursor-pointer transition-colors ${
                  selectedRow === row
                    ? "bg-brand/20 ring-2 ring-inset ring-brand/60 text-white"
                    : "border-b border-white/5 hover:bg-bg-hover/50"
                }`}
                onClick={() => setSelectedRow(row === selectedRow ? null : row)}
              >
                {cols.map((c) => (
                  <td key={c} className={`px-3 py-2.5 font-mono whitespace-nowrap max-w-[200px] truncate ${selectedRow === row ? "text-white" : "text-slate-300"}`}>
                    {fmt(row[c])}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-slate-500 w-7">
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${selectedRow === row ? "rotate-90 text-brand-glow" : ""}`} />
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
            <div ref={mappingRef} className="rounded-lg border border-brand/30 bg-brand/5 p-3 md:p-4 space-y-3 md:space-y-4">
              {/* Field → variable mapping */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-medium text-slate-300">字段 → 变量映射</span>
                  <span className="text-[11px] text-slate-500">
                    用 <span className="font-mono text-brand-glow">{"{{变量名}}"}</span> 在接口中引用
                  </span>
                </div>

                <div
                  className="rounded-md border border-white/5 flex flex-col"
                  style={{ resize: "vertical", overflow: "hidden", minHeight: "180px", maxHeight: "520px" }}
                >
                  {/* Desktop header */}
                  <div className="hidden sm:grid grid-cols-[20px_1fr_24px_1fr] gap-2 px-3 py-1.5 bg-bg-elevated/60 text-[11px] text-slate-500 font-medium shrink-0 border-b border-white/5">
                    <span />
                    <span>行字段</span>
                    <span />
                    <span>变量名（值）</span>
                  </div>
                  {/* Mobile header */}
                  <div className="sm:hidden grid grid-cols-[20px_1fr_24px_1fr] gap-2 px-3 py-1.5 bg-bg-elevated/60 text-[11px] text-slate-500 font-medium shrink-0 border-b border-white/5">
                    <span />
                    <span>行字段</span>
                    <span />
                    <span>变量名</span>
                  </div>
                  <div className="flex-1 overflow-auto divide-y divide-white/5">
                    {mapping.map((m, i) => {
                      const rawVal = selectedRow ? selectedRow[m.from] : undefined;
                      const displayVal = fmt(rawVal);
                      return (
                        <div key={m.from}>
                          {/* Desktop row */}
                          <div className={`hidden sm:grid grid-cols-[20px_1fr_24px_1fr] gap-2 px-3 py-2 items-center text-xs ${!m.enabled ? "opacity-40" : ""}`}>
                            <input
                              type="checkbox"
                              checked={m.enabled}
                              onChange={(e) => updateMapping(i, { enabled: e.target.checked })}
                              className="accent-brand cursor-pointer"
                            />
                            <span className="font-mono text-slate-300 truncate" title={m.from}>{m.from}</span>
                            <span className="text-slate-500 text-center">→</span>
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <input
                                className="input py-0.5 px-2 text-xs font-mono h-7"
                                value={m.to}
                                onChange={(e) => updateMapping(i, { to: e.target.value })}
                                disabled={!m.enabled}
                                placeholder="变量名"
                              />
                              <span className="font-mono text-[11px] text-slate-500 truncate px-1" title={displayVal}>
                                {displayVal}
                              </span>
                            </div>
                          </div>
                          {/* Mobile row */}
                          <div className={`sm:hidden px-3 py-2 text-xs space-y-1 ${!m.enabled ? "opacity-40" : ""}`}>
                            <div className="grid grid-cols-[20px_1fr_24px_1fr] gap-2 items-center">
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
                            </div>
                            <div className="pl-7 font-mono text-[11px] text-slate-500 truncate" title={displayVal}>
                              值：{displayVal}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Copyable chips for enabled mappings */}
                {mapping.filter((m) => m.enabled && m.to.trim()).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[11px] text-slate-500">点击复制：</span>
                    {mapping.filter((m) => m.enabled && m.to.trim()).map((m) => (
                      <CopyChip key={m.from} text={`{{${m.to.trim()}}}`} />
                    ))}
                  </div>
                )}
              </div>

              {/* Endpoint selector + run */}
              <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-white/5">
                <Select
                  value={actionEpId}
                  onChange={(v) => { setActionEpId(v); setActionResult(null); }}
                  options={endpoints.map((ep) => ({ value: ep.id, label: `[${ep.method}] ${ep.name}` }))}
                  placeholder="选择要执行的接口…"
                  className="text-xs flex-1 min-w-[200px]"
                />
                <button
                  className="btn-primary py-1.5 text-xs"
                  disabled={!actionEpId || !environmentId || runAction.isPending}
                  onClick={() => runAction.mutate()}
                >
                  <Play className="w-3 h-3" />
                  {runAction.isPending ? "执行中…" : "执行"}
                </button>
              </div>

              {/* Action result — same quality as main runner */}
              {actionResult && (
                <div className="pt-1 border-t border-white/5">
                  <ResultPanel result={actionResult} compact />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main RequestRunner ────────────────────────────────────────────────────────

export default function RequestRunner({
  endpoint,
  environmentId,
  projectId,
  onResult,
}: {
  endpoint: Endpoint;
  environmentId: string | null;
  projectId?: string | null;
  onResult?: (result: RunResult) => void;
}) {
  const { setEndpointRunStatus } = useAppStore();

  // ── ② Variable preview ──────────────────────────────────────────────────────
  const qc = useQueryClient();
  const envList = qc.getQueryData<Environment[]>(["environments", projectId ?? ""]) ?? [];
  const currentEnv = envList.find((e) => e.id === environmentId) ?? null;
  const { url: previewUrl, unresolved } = buildPreviewUrl(endpoint, currentEnv);

  const run = useMutation({
    mutationFn: () =>
      api.post<RunResult>("/api/run", {
        endpointId: endpoint.id,
        environmentId: environmentId ?? undefined,
      }),
    onSuccess: (r) => {
      setEndpointRunStatus(endpoint.id, r.status);
      onResult?.(r);
    },
    onError: () => {
      setEndpointRunStatus(endpoint.id, 0);
    },
  });

  // ── ① Cmd+Enter to run ──────────────────────────────────────────────────────
  const triggerRun = useCallback(() => {
    if (!run.isPending && environmentId) run.mutate();
  }, [run, environmentId]);
  useShortcut("Enter", triggerRun, { cmdOrCtrl: true });

  return (
    <div className="space-y-3">
      {/* ── Header row: method + preview URL + run button ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <MethodBadge method={endpoint.method} />
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className="font-mono text-sm text-slate-300 truncate">{endpoint.path}</span>
          {/* ② Preview substituted URL */}
          {currentEnv && (
            <div className="flex items-center gap-1">
              <Eye className="w-3 h-3 text-slate-600 shrink-0" />
              <PreviewUrl url={previewUrl} unresolved={unresolved} />
              {unresolved.length > 0 && (
                <span className="text-[10px] text-amber-400 shrink-0">
                  （{unresolved.length} 个变量未设置）
                </span>
              )}
            </div>
          )}
        </div>
        <button
          className="btn-primary shrink-0"
          onClick={() => run.mutate()}
          disabled={run.isPending || !environmentId}
          title={environmentId ? "执行 (⌘↵)" : "请先在顶部选择环境"}
        >
          <Play className="w-4 h-4" />
          {run.isPending ? "执行中…" : "执行"}
        </button>
      </div>
    </div>
  );
}
