import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit3, Trash2, Activity, Search, Save, Tag as TagIcon, X, Terminal } from "lucide-react";
import { toast } from "sonner";
import { api, Endpoint } from "@/lib/api";
import { useAppStore } from "@/store/app";
import MethodBadge from "@/components/MethodBadge";
import Modal from "@/components/Modal";
import Empty from "@/components/Empty";
import JsonEditor from "@/components/JsonEditor";
import KeyValueEditor, { recordToRows, rowsToRecord, KV } from "@/components/KeyValueEditor";
import RequestRunner from "@/components/RequestRunner";
import TagInput from "@/components/TagInput";
import CurlImport from "@/components/CurlImport";
import { safeJson } from "@/lib/utils";
import { Environment } from "@/lib/api";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const UNTAGGED = "__untagged__";

function parseTags(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.map(String).filter(Boolean);
  } catch {
    /* ignore */
  }
  return [];
}

export default function EndpointsPage() {
  const qc = useQueryClient();
  const { activeProjectId, activeEnvironmentId } = useAppStore();
  const [keyword, setKeyword] = useState("");
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [methodFilter, setMethodFilter] = useState<string>("");
  const [curlOpen, setCurlOpen] = useState(false);
  const [curlPrefill, setCurlPrefill] = useState<Partial<ReturnType<typeof makeDraft>> | null>(null);

  const { data: endpoints = [] } = useQuery({
    queryKey: ["endpoints", activeProjectId],
    queryFn: () =>
      activeProjectId
        ? api.get<Endpoint[]>(`/api/endpoints?projectId=${activeProjectId}`)
        : Promise.resolve([]),
    enabled: !!activeProjectId,
  });

  const { data: envs = [] } = useQuery({
    queryKey: ["environments", activeProjectId],
    queryFn: () =>
      activeProjectId
        ? api.get<Environment[]>(`/api/environments?projectId=${activeProjectId}`)
        : Promise.resolve([]),
    enabled: !!activeProjectId,
  });
  const baseUrls = envs.map((e) => e.baseUrl);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ep of endpoints) {
      const tags = parseTags(ep.tags);
      if (tags.length === 0) counts.set(UNTAGGED, (counts.get(UNTAGGED) ?? 0) + 1);
      for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) =>
      a[0] === UNTAGGED ? 1 : b[0] === UNTAGGED ? -1 : a[0].localeCompare(b[0])
    );
  }, [endpoints]);

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return endpoints.filter((e) => {
      if (methodFilter && e.method.toUpperCase() !== methodFilter) return false;
      if (activeTags.size > 0) {
        const tags = parseTags(e.tags);
        const hasUntagged = activeTags.has(UNTAGGED);
        const matchesTag = tags.some((t) => activeTags.has(t)) || (hasUntagged && tags.length === 0);
        if (!matchesTag) return false;
      }
      if (!k) return true;
      return (
        e.name.toLowerCase().includes(k) ||
        e.path.toLowerCase().includes(k) ||
        (e.description ?? "").toLowerCase().includes(k) ||
        parseTags(e.tags).some((t) => t.toLowerCase().includes(k))
      );
    });
  }, [endpoints, keyword, activeTags, methodFilter]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Endpoint[]>();
    for (const ep of filtered) {
      const tags = parseTags(ep.tags);
      const keys = tags.length ? tags : [UNTAGGED];
      for (const k of keys) {
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(ep);
      }
    }
    return Array.from(groups.entries()).sort((a, b) =>
      a[0] === UNTAGGED ? 1 : b[0] === UNTAGGED ? -1 : a[0].localeCompare(b[0])
    );
  }, [filtered]);

  const selected = endpoints.find((e) => e.id === selectedId) ?? filtered[0];

  const toggleTag = (t: string) => {
    const next = new Set(activeTags);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setActiveTags(next);
  };

  if (!activeProjectId) {
    return (
      <div className="p-8">
        <Empty title="请先在顶部选择一个项目" hint="接口、环境都是以项目为单位管理的。" />
      </div>
    );
  }

  return (
    <div className="h-full grid grid-cols-[320px_1fr]">
      <div className="border-r border-white/5 bg-bg-panel/30 flex flex-col min-h-0">
        <div className="p-3 border-b border-white/5 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                className="input pl-8"
                placeholder="搜索名称/路径/标签"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <button
              className="btn-primary px-2"
              onClick={() => { setCurlPrefill(null); setSelectedId(null); setEditOpen(true); }}
              title="新建接口"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              className="btn-ghost px-2"
              onClick={() => setCurlOpen(true)}
              title="从 curl 导入"
            >
              <Terminal className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <select
              className="input py-1 text-xs w-auto"
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
            >
              <option value="">全部方法</option>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            {(activeTags.size > 0 || keyword || methodFilter) && (
              <button
                className="btn-ghost text-[11px] px-2 py-1"
                onClick={() => {
                  setActiveTags(new Set());
                  setKeyword("");
                  setMethodFilter("");
                }}
              >
                <X className="w-3 h-3" /> 清空筛选
              </button>
            )}
          </div>
          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {allTags.map(([t, count]) => {
                const active = activeTags.has(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleTag(t)}
                    className={`chip text-[11px] ${
                      active
                        ? "bg-brand/25 text-white ring-1 ring-brand/40"
                        : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {t === UNTAGGED ? "未分组" : t}
                    <span className="text-[10px] opacity-70">·{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-2">
          {filtered.length === 0 ? (
            <Empty icon={<Activity className="w-5 h-5" />} title="暂无匹配接口" />
          ) : (
            <AnimatePresence>
              {grouped.map(([tag, items]) => (
                <motion.div key={tag} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="px-2 pt-3 pb-1 text-[10px] uppercase tracking-wide text-slate-500 flex items-center gap-1">
                    <TagIcon className="w-3 h-3" />
                    {tag === UNTAGGED ? "未分组" : tag}
                    <span className="opacity-70">({items.length})</span>
                  </div>
                  {items.map((ep) => (
                    <motion.button
                      key={`${tag}-${ep.id}`}
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
                </motion.div>
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
        endpoint={selected && editOpen && !curlPrefill ? selected : null}
        projectId={activeProjectId}
        existingTags={allTags.filter(([t]) => t !== UNTAGGED).map(([t]) => t)}
        prefill={curlPrefill ?? undefined}
        onClose={() => { setEditOpen(false); setCurlPrefill(null); }}
        onSaved={(id) => {
          qc.invalidateQueries({ queryKey: ["endpoints", activeProjectId] });
          setEditOpen(false);
          setCurlPrefill(null);
          setSelectedId(id);
        }}
      />

      <CurlImport
        open={curlOpen}
        onClose={() => setCurlOpen(false)}
        baseUrls={baseUrls}
        onImport={(parsed) => {
          const draft = makeDraft(null, activeProjectId!);
          draft.method = parsed.method;
          draft.path = parsed.url;
          draft._headers = Object.entries(parsed.headers).map(([key, value]) => ({ key, value }));
          draft._query = Object.entries(parsed.query).map(([key, value]) => ({ key, value }));
          draft.body = parsed.body;
          draft.bodyType = parsed.bodyType;
          setCurlPrefill(draft);
          setCurlOpen(false);
          setSelectedId(null);
          setEditOpen(true);
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

  const tags = parseTags(endpoint.tags);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <MethodBadge method={endpoint.method} />
            <h2 className="text-lg font-semibold text-white">{endpoint.name}</h2>
            {tags.map((t) => (
              <span key={t} className="chip bg-brand/15 text-brand-glow text-[11px]">
                {t}
              </span>
            ))}
          </div>
          {endpoint.description && (
            <p className="text-sm text-slate-400">{endpoint.description}</p>
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
  existingTags,
  prefill,
  onClose,
  onSaved,
}: {
  open: boolean;
  endpoint: Endpoint | null;
  projectId: string;
  existingTags: string[];
  prefill?: Partial<ReturnType<typeof makeDraft>>;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const isNew = !endpoint;
  const [form, setForm] = useState(() => ({ ...makeDraft(endpoint, projectId), ...(prefill ?? {}) }));
  const [tab, setTab] = useState<"params" | "headers" | "body" | "extract" | "pre" | "post">("params");

  useEffect(() => {
    if (open) setForm({ ...makeDraft(endpoint, projectId), ...(prefill ?? {}) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { data: allProjects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get<{ id: string; name: string }[]>("/api/projects"),
  });

  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        headers: JSON.stringify(rowsToRecord(form._headers as KV[])),
        query: JSON.stringify(rowsToRecord(form._query as KV[])),
        extract: JSON.stringify(rowsToRecord(form._extract as KV[])),
        tags: JSON.stringify(form._tags),
      };
      delete (payload as any)._headers;
      delete (payload as any)._query;
      delete (payload as any)._extract;
      delete (payload as any)._tags;
      // preScript / postScript pass through as-is
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

  const suggested = existingTags.filter((t) => !form._tags.includes(t)).slice(0, 8);

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
        {!isNew && allProjects.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 shrink-0">所属项目</span>
            <select
              className="input py-1.5 text-xs"
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            >
              {allProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <div className="text-xs text-slate-400 mb-1.5">标签（用于分组和搜索）</div>
          <TagInput
            value={form._tags}
            onChange={(tags) => setForm({ ...form, _tags: tags })}
            placeholder="例如：订阅、用户、运维；回车或逗号分隔"
          />
          {suggested.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              <span className="text-[11px] text-slate-500">已有：</span>
              {suggested.map((t) => (
                <button
                  key={t}
                  className="chip bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white text-[11px]"
                  onClick={() => setForm({ ...form, _tags: [...form._tags, t] })}
                >
                  + {t}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-b border-white/5 flex gap-1 flex-wrap">
          {(["params", "headers", "body", "extract", "pre", "post"] as const).map((t) => (
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
        {tab === "pre" && (
          <div className="space-y-2">
            <div className="text-[11px] text-slate-500">
              请求发出前执行的 JS 脚本。可用变量：<code className="text-brand-glow">vars</code>（环境变量池，可读写）、
              <code className="text-brand-glow">request</code>（含 method/headers/query/body/url，可修改）、
              <code className="text-brand-glow">console.log()</code>。<br />
              示例：<code className="text-accent">vars.ts = Date.now(); request.headers['X-Timestamp'] = String(vars.ts);</code>
            </div>
            <JsonEditor
              value={form.preScript}
              onChange={(v) => setForm({ ...form, preScript: v })}
              height={220}
              language="plaintext"
            />
          </div>
        )}
        {tab === "post" && (
          <div className="space-y-2">
            <div className="text-[11px] text-slate-500">
              收到响应后执行的 JS 脚本。可用变量：<code className="text-brand-glow">vars</code>（可读写）、
              <code className="text-brand-glow">response</code>（含 status/body/headers）、
              <code className="text-brand-glow">console.log()</code>。<br />
              示例：<code className="text-accent">if (response.status !== 200) throw new Error('failed'); vars.token = response.body.data.token;</code>
            </div>
            <JsonEditor
              value={form.postScript}
              onChange={(v) => setForm({ ...form, postScript: v })}
              height={220}
              language="plaintext"
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
    preScript: ep?.preScript ?? "",
    postScript: ep?.postScript ?? "",
    _tags: parseTags(ep?.tags),
    _headers: recordToRows(safeJson(ep?.headers, {}) as Record<string, string>),
    _query: recordToRows(safeJson(ep?.query, {}) as Record<string, string>),
    _extract: recordToRows(safeJson(ep?.extract, {}) as Record<string, string>),
  };
}

function tabLabel(t: string) {
  return {
    params: "Query 参数", headers: "请求头", body: "Body",
    extract: "变量提取", pre: "前置脚本", post: "后置脚本",
  }[t] ?? t;
}
