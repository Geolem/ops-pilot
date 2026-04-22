import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { History as HistoryIcon, Clock, Copy, Repeat2, Terminal, ChevronRight } from "lucide-react";
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

export default function HistoryPage() {
  const qc = useQueryClient();
  const [curlOpen, setCurlOpen] = useState(false);
  const [curlText, setCurlText] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data = [] } = useQuery({
    queryKey: ["history"],
    queryFn: () => api.get<HistoryItem[]>("/api/history?limit=100"),
    refetchInterval: 5000,
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
          <p className="text-sm text-slate-400 mt-1">最近 100 条调用记录（每 5s 自动刷新）。行内可重放或导出 curl。</p>
        </div>
      </div>

      {data.length === 0 ? (
        <Empty icon={<HistoryIcon className="w-5 h-5" />} title="暂无记录" />
      ) : (
        <div className="card divide-y divide-white/5">
          {data.map((h, i) => (
            <motion.div
              key={h.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i * 0.008, 0.25) }}
              className="px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-bg-hover/40 group"
            >
              <MethodBadge method={h.method} />
              <span className={`font-semibold w-12 text-center ${statusClass(h.status)}`}>
                {h.status || "ERR"}
              </span>
              <button
                onClick={() => setDetailId(h.id)}
                className="font-mono text-xs text-slate-300 hover:text-white truncate flex-1 text-left"
                title={h.url}
              >
                {h.url}
              </button>
              <span className="text-xs text-slate-500 flex items-center gap-1 shrink-0 w-20 justify-end">
                <Clock className="w-3 h-3" /> {h.durationMs}ms
              </span>
              <span className="text-xs text-slate-500 shrink-0 w-36 text-right">
                {new Date(h.createdAt).toLocaleString()}
              </span>
              <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  className="btn-ghost p-1.5"
                  title="重放"
                  onClick={() => replay.mutate(h.id)}
                  disabled={replay.isPending}
                >
                  <Repeat2 className="w-3.5 h-3.5" />
                </button>
                <button className="btn-ghost p-1.5" title="导出 curl" onClick={() => exportCurl(h)}>
                  <Terminal className="w-3.5 h-3.5" />
                </button>
                <button className="btn-ghost p-1.5" title="查看详情" onClick={() => setDetailId(h.id)}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

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
    </div>
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
      <div className="flex gap-1 text-xs border-b border-white/5">
        {(["response", "request"] as const).map((t) => (
          <button
            key={t}
            className={`px-3 py-2 -mb-px border-b-2 ${
              tab === t ? "border-brand text-white" : "border-transparent text-slate-400 hover:text-white"
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
