import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit3, Trash2, Activity, Search, Save } from "lucide-react";
import { toast } from "sonner";
import { api, Endpoint } from "@/lib/api";
import { useAppStore } from "@/store/app";
import MethodBadge from "@/components/MethodBadge";
import Modal from "@/components/Modal";
import Empty from "@/components/Empty";
import JsonEditor from "@/components/JsonEditor";
import KeyValueEditor, { recordToRows, rowsToRecord, KV } from "@/components/KeyValueEditor";
import RequestRunner from "@/components/RequestRunner";
import { safeJson, stringifyPretty } from "@/lib/utils";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

export default function EndpointsPage() {
  const qc = useQueryClient();
  const { activeProjectId, activeEnvironmentId } = useAppStore();
  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const { data: endpoints = [] } = useQuery({
    queryKey: ["endpoints", activeProjectId],
    queryFn: () =>
      activeProjectId
        ? api.get<Endpoint[]>(`/api/endpoints?projectId=${activeProjectId}`)
        : Promise.resolve([]),
    enabled: !!activeProjectId,
  });

  const filtered = useMemo(() => {
    if (!keyword) return endpoints;
    const k = keyword.toLowerCase();
    return endpoints.filter(
      (e) => e.name.toLowerCase().includes(k) || e.path.toLowerCase().includes(k)
    );
  }, [endpoints, keyword]);

  const selected = endpoints.find((e) => e.id === selectedId) ?? filtered[0];

  if (!activeProjectId) {
    return (
      <div className="p-8">
        <Empty title="请先在顶部选择一个项目" hint="接口、环境都是以项目为单位管理的。" />
      </div>
    );
  }

  return (
    <div className="h-full grid grid-cols-[320px_1fr]">
      <div className="border-r border-white/5 bg-bg-panel/30 flex flex-col">
        <div className="p-3 border-b border-white/5 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              className="input pl-8"
              placeholder="搜索接口"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <button
            className="btn-primary px-2"
            onClick={() => {
              setSelectedId(null);
              setEditOpen(true);
            }}
            title="新建接口"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {filtered.length === 0 ? (
            <Empty icon={<Activity className="w-5 h-5" />} title="暂无接口" />
          ) : (
            <AnimatePresence>
              {filtered.map((ep) => (
                <motion.button
                  key={ep.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSelectedId(ep.id)}
                  className={`w-full text-left px-3 py-2 rounded-md my-0.5 transition-colors ${
                    selected?.id === ep.id
                      ? "bg-brand/15 ring-1 ring-brand/30"
                      : "hover:bg-bg-hover/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <MethodBadge method={ep.method} />
                    <span className="text-sm text-white truncate flex-1">{ep.name}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 truncate">{ep.path}</div>
                </motion.button>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      <div className="overflow-auto">
        {selected ? (
          <EndpointDetail
            endpoint={selected}
            environmentId={activeEnvironmentId}
            onEdit={() => setEditOpen(true)}
          />
        ) : (
          <Empty title="选择左侧接口查看详情" />
        )}
      </div>

      <EndpointEditor
        open={editOpen}
        endpoint={selected && editOpen ? selected : null}
        projectId={activeProjectId}
        onClose={() => setEditOpen(false)}
        onSaved={(id) => {
          qc.invalidateQueries({ queryKey: ["endpoints", activeProjectId] });
          setEditOpen(false);
          setSelectedId(id);
        }}
      />
    </div>
  );
}

function EndpointDetail({
  endpoint,
  environmentId,
  onEdit,
}: {
  endpoint: Endpoint;
  environmentId: string | null;
  onEdit: () => void;
}) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: (id: string) => api.del(`/api/endpoints/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["endpoints"] });
      toast.success("已删除");
    },
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MethodBadge method={endpoint.method} />
            <h2 className="text-lg font-semibold text-white">{endpoint.name}</h2>
          </div>
          {endpoint.description && (
            <p className="text-sm text-slate-400 mt-1">{endpoint.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button className="btn-ghost" onClick={onEdit}>
            <Edit3 className="w-3.5 h-3.5" /> 编辑
          </button>
          <button
            className="btn-danger"
            onClick={() => {
              if (confirm(`删除接口 ${endpoint.name}？`)) del.mutate(endpoint.id);
            }}
          >
            <Trash2 className="w-3.5 h-3.5" /> 删除
          </button>
        </div>
      </div>

      <RequestRunner endpoint={endpoint} environmentId={environmentId} />
    </div>
  );
}

function EndpointEditor({
  open,
  endpoint,
  projectId,
  onClose,
  onSaved,
}: {
  open: boolean;
  endpoint: Endpoint | null;
  projectId: string;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const isNew = !endpoint;
  const [form, setForm] = useState(() => makeDraft(endpoint, projectId));
  const [tab, setTab] = useState<"params" | "headers" | "body" | "extract">("params");

  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        headers: JSON.stringify(rowsToRecord(form._headers as KV[])),
        query: JSON.stringify(rowsToRecord(form._query as KV[])),
        extract: JSON.stringify(rowsToRecord(form._extract as KV[])),
      };
      delete (payload as any)._headers;
      delete (payload as any)._query;
      delete (payload as any)._extract;
      if (form.id) return api.patch<Endpoint>(`/api/endpoints/${form.id}`, payload);
      return api.post<Endpoint>("/api/endpoints", payload);
    },
    onSuccess: (ep) => {
      toast.success("接口已保存");
      qc.invalidateQueries({ queryKey: ["endpoints"] });
      onSaved(ep.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title={isNew ? "新建接口" : "编辑接口"} width="max-w-3xl">
      <div className="space-y-3">
        <div className="grid grid-cols-[120px_1fr] gap-2">
          <select
            className="input"
            value={form.method}
            onChange={(e) => setForm({ ...form, method: e.target.value })}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <input
            className="input font-mono"
            value={form.path}
            onChange={(e) => setForm({ ...form, path: e.target.value })}
            placeholder="/api/users/{{userId}}"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input
            className="input"
            placeholder="接口名称"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="input"
            placeholder="描述（可选）"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div className="border-b border-white/5 flex gap-1">
          {(["params", "headers", "body", "extract"] as const).map((t) => (
            <button
              key={t}
              className={`px-3 py-2 text-xs -mb-px border-b-2 ${
                tab === t ? "border-brand text-white" : "border-transparent text-slate-400 hover:text-white"
              }`}
              onClick={() => setTab(t)}
            >
              {tabLabel(t)}
            </button>
          ))}
        </div>

        {tab === "params" && (
          <KeyValueEditor
            rows={form._query as KV[]}
            onChange={(r) => setForm({ ...form, _query: r })}
            keyPlaceholder="query key"
            valuePlaceholder="值（支持 {{var}}）"
          />
        )}
        {tab === "headers" && (
          <KeyValueEditor
            rows={form._headers as KV[]}
            onChange={(r) => setForm({ ...form, _headers: r })}
            keyPlaceholder="Header 名"
            valuePlaceholder="值（支持 {{var}}）"
          />
        )}
        {tab === "body" && (
          <div className="space-y-2">
            <div className="flex gap-2 items-center text-xs text-slate-400">
              <span>类型</span>
              <select
                className="input py-1 w-32"
                value={form.bodyType}
                onChange={(e) => setForm({ ...form, bodyType: e.target.value })}
              >
                <option value="json">json</option>
                <option value="form">form-urlencoded</option>
                <option value="text">text</option>
                <option value="none">none</option>
              </select>
            </div>
            <JsonEditor
              value={form.body}
              onChange={(v) => setForm({ ...form, body: v })}
              height={220}
              language={form.bodyType === "json" ? "json" : "plaintext"}
            />
          </div>
        )}
        {tab === "extract" && (
          <div className="space-y-2">
            <div className="text-[11px] text-slate-500">
              从响应提取变量（左侧是变量名，右侧是 JSONPath 或点路径，从
              <code className="text-brand-glow">body</code>/<code className="text-brand-glow">headers</code>/<code className="text-brand-glow">status</code>
              开始，例如 <code className="text-brand-glow">$.body.data.token</code>）。提取结果会写入当前环境的变量池。
            </div>
            <KeyValueEditor
              rows={form._extract as KV[]}
              onChange={(r) => setForm({ ...form, _extract: r })}
              keyPlaceholder="变量名，如 token"
              valuePlaceholder="$.body.data.token"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button className="btn-ghost" onClick={onClose}>取消</button>
          <button
            className="btn-primary"
            disabled={!form.name || !form.path}
            onClick={() => save.mutate()}
          >
            <Save className="w-4 h-4" /> 保存
          </button>
        </div>
      </div>
    </Modal>
  );
}

function makeDraft(ep: Endpoint | null, projectId: string) {
  return {
    id: ep?.id,
    projectId,
    name: ep?.name ?? "",
    description: ep?.description ?? "",
    method: ep?.method ?? "GET",
    path: ep?.path ?? "",
    body: ep?.body ?? "",
    bodyType: ep?.bodyType ?? "json",
    tags: ep?.tags ?? "[]",
    _headers: recordToRows(safeJson(ep?.headers, {}) as Record<string, string>),
    _query: recordToRows(safeJson(ep?.query, {}) as Record<string, string>),
    _extract: recordToRows(safeJson(ep?.extract, {}) as Record<string, string>),
  };
}

function tabLabel(t: string) {
  return { params: "Query 参数", headers: "请求头", body: "Body", extract: "变量提取" }[t] ?? t;
}
