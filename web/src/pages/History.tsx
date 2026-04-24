import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { History as HistoryIcon, Clock, Copy, Repeat2, Terminal, ChevronRight, CheckSquare, GitCompare, ChevronLeft } from "lucide-react";
import { api, RunResult } from "@/lib/api";
import MethodBadge from "@/components/MethodBadge";
import Empty from "@/components/Empty";
import Modal from "@/components/Modal";
import JsonEditor from "@/components/JsonEditor";
import { statusClass, safeJson, stringifyPretty } from "@/lib/utils";
import { buildCurl } from "@/lib/curl";

interface HistoryItem {
  id: string;
  method: string;
  url: string;
  status: number | null;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
  requestHeaders: string;
  requestBody: string | null;
  responseHeaders: string;
  responseBody: string | null;
  endpointId: string | null;
  environmentId: string | null;
}

const PAGE_SIZE = 50;

export default function HistoryPage() {
  const qc = useQueryClient();
  const [curlOpen, setCurlOpen] = useState(false);
  const [curlText, setCurlText] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [diffIds, setDiffIds] = useState<[string, string] | null>(null);
  const [page, setPage] = useState(0);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= 2) return prev; // max 2
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const { data = [], isLoading } = useQuery({
    queryKey: ["history", page],
    queryFn: () => api.get<HistoryItem[]>(`/api/history?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`),
    refetchInterval: page === 0 ? 5000 : false,
  });

  const detail = data.find((h) => h.id === detailId);

  const replay = useMutation({
    mutationFn: (id: string) => api.post<RunResult>(`/api/history/${id}/replay`),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["history"] });
      if (r.error) toast.error(`重放失败：${r.error}`);
      else toast.success(`重放完成 · ${r.status} · ${r.durationMs}ms`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCurl = (h: HistoryItem) => {
    const curl = buildCurl({
      method: h.method,
      url: h.url,
      headers: safeJson(h.requestHeaders, {}) as Record<string, string>,
      body: h.requestBody,
    });
    setCurlText(curl);
    setCurlOpen(true);
  };

  const copyCurl = async () => {
    try {
      await navigator.clipboard.writeText(curlText);
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("复制失败，请手动选择");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">执行历史</h1>
          <p className="text-sm text-slate-400 mt-1">每页 {PAGE_SIZE} 条（首页每 5s 自动刷新）。行内可重放或导出 curl。</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size === 2 ? (
            <>
              <button className="btn-ghost text-xs" onClick={clearSelection}>取消</button>
              <button
                className="btn-primary text-xs"
                onClick={() => {
                  const ids = [...selectedIds];
                  setDiffIds([ids[0], ids[1]]);
                  clearSelection();
                }}
              >
                <GitCompare className="w-3.5 h-3.5" /> 比对
              </button>
            </>
          ) : selectedIds.size === 1 ? (
            <span className="text-xs text-slate-500">再选 1 条即可比对</span>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="card flex items-center justify-center py-16 text-slate-500 text-sm gap-2">
          <HistoryIcon className="w-4 h-4 animate-pulse" /> 加载中…
        </div>
      ) : data.length === 0 && page === 0 ? (
        <Empty icon={<HistoryIcon className="w-5 h-5" />} title="暂无记录" hint="执行接口后会在这里显示调用记录" />
      ) : (
        <div className="card divide-y divide-white/5">
          {data.map((h, i) => (
            <motion.div
              key={h.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i * 0.008, 0.25) }}
              className="px-4 py-3 hover:bg-bg-hover/40 group cursor-pointer"
              onClick={() => setDetailId(h.id)}
            >
              {/* ── Desktop row ── */}
              <div className="hidden sm:flex items-center gap-3 text-sm">
                <button
                  className={`shrink-0 w-4 h-4 rounded border transition-colors ${
                    selectedIds.has(h.id)
                      ? "bg-brand border-brand text-white"
                      : "border-white/20 hover:border-white/40"
                  }`}
                  onClick={(e) => { e.stopPropagation(); toggleSelect(h.id); }}
                >
                  {selectedIds.has(h.id) && <CheckSquare className="w-3.5 h-3.5" />}
                </button>
                <MethodBadge method={h.method} />
                <span className={`font-semibold w-12 text-center shrink-0 ${statusClass(h.status)}`}>
                  {h.status || "ERR"}
                </span>
                <span className="font-mono text-xs text-slate-300 truncate flex-1 min-w-0" title={h.url}>
                  {h.url}
                </span>
                <span className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
                  <Clock className="w-3 h-3" /> {h.durationMs}ms
                </span>
                <span className="text-xs text-slate-500 shrink-0 hidden lg:block">
                  {new Date(h.createdAt).toLocaleString()}
                </span>
                <div
                  className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button className="btn-ghost p-1.5" title="重放" aria-label="重放" onClick={() => replay.mutate(h.id)} disabled={replay.isPending}>
                    <Repeat2 className="w-3.5 h-3.5" />
                  </button>
                  <button className="btn-ghost p-1.5" title="导出 curl" aria-label="导出 curl" onClick={() => exportCurl(h)}>
                    <Terminal className="w-3.5 h-3.5" />
                  </button>
                  <button className="btn-ghost p-1.5" title="查看详情" aria-label="查看详情" onClick={() => setDetailId(h.id)}>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* ── Mobile card ── */}
              <div className="sm:hidden space-y-1.5">
                <div className="flex items-center gap-1">
                  <button
                    className={`shrink-0 w-3.5 h-3.5 rounded border transition-colors ${
                      selectedIds.has(h.id)
                        ? "bg-brand border-brand text-white"
                        : "border-white/20 hover:border-white/40"
                    }`}
                    onClick={(e) => { e.stopPropagation(); toggleSelect(h.id); }}
                  >
                    {selectedIds.has(h.id) && <CheckSquare className="w-3 h-3" />}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <MethodBadge method={h.method} />
                  <span className={`font-semibold text-sm ${statusClass(h.status)}`}>{h.status || "ERR"}</span>
                  <span className="text-xs text-slate-400 flex items-center gap-1 ml-auto">
                    <Clock className="w-3 h-3" /> {h.durationMs}ms
                  </span>
                </div>
                <div className="font-mono text-[11px] text-slate-400 truncate">{h.url}</div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">{new Date(h.createdAt).toLocaleTimeString()}</span>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button className="btn-ghost p-1.5 text-xs" aria-label="重放" onClick={() => replay.mutate(h.id)} disabled={replay.isPending}>
                      <Repeat2 className="w-3.5 h-3.5" />
                    </button>
                    <button className="btn-ghost p-1.5 text-xs" aria-label="导出 curl" onClick={() => exportCurl(h)}>
                      <Terminal className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>第 {page + 1} 页</span>
        <div className="flex items-center gap-1">
          <button
            className="btn-ghost p-1.5 disabled:opacity-30"
            disabled={page === 0}
            onClick={() => { setPage((p) => p - 1); setSelectedIds(new Set()); }}
            aria-label="上一页"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            className="btn-ghost p-1.5 disabled:opacity-30"
            disabled={data.length < PAGE_SIZE}
            onClick={() => { setPage((p) => p + 1); setSelectedIds(new Set()); }}
            aria-label="下一页"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <Modal open={curlOpen} onClose={() => setCurlOpen(false)} title="curl 命令" width="max-w-2xl">
        <div className="space-y-3">
          <pre className="bg-bg-elevated/70 rounded-lg p-3 text-xs font-mono text-slate-200 whitespace-pre-wrap break-all max-h-[50vh] overflow-auto">
            {curlText}
          </pre>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setCurlOpen(false)}>关闭</button>
            <button className="btn-primary" onClick={copyCurl}>
              <Copy className="w-4 h-4" /> 复制
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!detailId} onClose={() => setDetailId(null)} title="调用详情" width="max-w-3xl">
        {detail && <HistoryDetail item={detail} />}
      </Modal>

      {/* ── 2.3 Response diff ── */}
      <ResponseDiff key={diffIds?.join("-")} ids={diffIds} data={data} onClose={() => setDiffIds(null)} />
    </div>
  );
}

function ResponseDiff({
  ids,
  data,
  onClose,
}: {
  ids: [string, string] | null;
  data: HistoryItem[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"body" | "headers">("body");

  if (!ids) return null;
  const a = data.find((h) => h.id === ids[0]);
  const b = data.find((h) => h.id === ids[1]);
  if (!a || !b) return null;

  const formatBody = (raw: string | null) => {
    if (!raw) return "";
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw.slice(0, 5000);
    }
  };

  const MAX_DIFF_CHARS = 80_000;
  // Escape </script> sequences to prevent breaking out of the script tag
  const safeScript = (v: string) =>
    JSON.stringify(v.slice(0, MAX_DIFF_CHARS)).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");

  const originalValue = tab === "body" ? formatBody(a.responseBody) : stringifyPretty(safeJson(a.responseHeaders, {}));
  const modifiedValue = tab === "body" ? formatBody(b.responseBody) : stringifyPretty(safeJson(b.responseHeaders, {}));

  return (
    <Modal open={true} onClose={onClose} title="响应比对" width="max-w-5xl">
      <div className="space-y-3">
        {/* Source info */}
        <div className="grid grid-cols-2 gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <MethodBadge method={a.method} />
            <span className={`font-semibold ${statusClass(a.status)}`}>{a.status || "ERR"}</span>
            <span>{a.durationMs}ms</span>
            <span className="font-mono text-[11px] truncate">{a.url}</span>
          </div>
          <div className="flex items-center gap-2">
            <MethodBadge method={b.method} />
            <span className={`font-semibold ${statusClass(b.status)}`}>{b.status || "ERR"}</span>
            <span>{b.durationMs}ms</span>
            <span className="font-mono text-[11px] truncate">{b.url}</span>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex gap-2">
          {(["body", "headers"] as const).map((t) => (
            <button
              key={t}
              className={`text-xs px-2.5 py-1 rounded transition-colors ${
                tab === t
                  ? "bg-brand/15 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
              onClick={() => setTab(t)}
            >
              {t === "body" ? "响应体" : "响应头"}
            </button>
          ))}
        </div>

        {/* Monaco diff */}
        <div className="rounded-lg overflow-hidden border border-white/5">
          <div style={{ height: 400 }} className="monaco-editor-container">
            <iframe
              sandbox="allow-scripts"
              srcDoc={`<!DOCTYPE html>
<html>
<head>
<script src="https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs/loader.min.js"><\/script>
</head>
<body style="margin:0;background:#1e1e1e">
<div id="container" style="height:400px"></div>
<script>
require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });
require(['vs/editor/editor.main'], function () {
  var original = ${safeScript(originalValue)};
  var modified = ${safeScript(modifiedValue)};
  var c = document.getElementById('container');
  var diffEditor = monaco.editor.createDiffEditor(c, {
    theme: 'vs-dark',
    fontSize: 12,
    wordWrap: 'on',
    scrollBeyondLastLine: false,
    minimap: { enabled: false }
  });
  diffEditor.setModel({
    original: monaco.editor.createModel(original, 'json'),
    modified: monaco.editor.createModel(modified, 'json')
  });
});
<\/script>
</body>
</html>`}
              className="w-full"
              style={{ height: 400 }}
              title="Diff Editor"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function HistoryDetail({ item }: { item: HistoryItem }) {
  const [tab, setTab] = useState<"response" | "request">("response");
  const reqHeaders = safeJson(item.requestHeaders, {});
  const resHeaders = safeJson(item.responseHeaders, {});
  let responseBody: unknown = item.responseBody ?? "";
  if (item.responseBody) {
    try {
      responseBody = JSON.parse(item.responseBody);
    } catch {
      /* keep as text */
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <MethodBadge method={item.method} />
        <span className={`font-semibold ${statusClass(item.status)}`}>{item.status || "ERR"}</span>
        <span className="text-xs text-slate-400 flex items-center gap-1">
          <Clock className="w-3 h-3" /> {item.durationMs}ms
        </span>
        <span className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</span>
      </div>
      <div className="font-mono text-xs text-slate-300 break-all">{item.url}</div>
      {item.error && (
        <div className="text-xs text-rose-300 bg-rose-500/10 rounded-md px-3 py-2">{item.error}</div>
      )}
      <div className="flex gap-0.5 flex-wrap">
        {(["response", "request"] as const).map((t) => (
          <button
            key={t}
            className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
              tab === t
                ? "bg-brand/20 text-brand dark:text-brand-glow ring-1 ring-brand/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
            onClick={() => setTab(t)}
          >
            {t === "response" ? "响应" : "请求"}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="space-y-2"
        >
          {tab === "response" && (
            <>
              <div className="text-xs text-slate-400">响应头</div>
              <JsonEditor value={stringifyPretty(resHeaders)} onChange={() => {}} height={140} />
              <div className="text-xs text-slate-400">响应体</div>
              <JsonEditor
                value={typeof responseBody === "string" ? responseBody : stringifyPretty(responseBody)}
                onChange={() => {}}
                height={260}
              />
            </>
          )}
          {tab === "request" && (
            <>
              <div className="text-xs text-slate-400">请求头</div>
              <JsonEditor value={stringifyPretty(reqHeaders)} onChange={() => {}} height={140} />
              <div className="text-xs text-slate-400">请求体</div>
              <JsonEditor
                value={item.requestBody ?? ""}
                onChange={() => {}}
                height={200}
                language={item.requestBody?.trim().startsWith("{") ? "json" : "plaintext"}
              />
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
