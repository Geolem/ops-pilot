import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit3, Trash2, Activity, Search, Save, Tag as TagIcon, X, Terminal, Copy, ChevronLeft, ChevronDown, Play, Clock, AlertTriangle, Maximize2, RefreshCw, Check, Star } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { api, Endpoint, Environment, RunResult } from "@/lib/api";
import { useAppStore } from "@/store/app";
import { useShortcut } from "@/hooks/useShortcut";
import { safeJson, statusClass, stringifyPretty } from "@/lib/utils";
import MethodBadge from "@/components/MethodBadge";
import Modal from "@/components/Modal";
import Empty from "@/components/Empty";
import JsonEditor from "@/components/JsonEditor";
import KeyValueEditor, { recordToRows, rowsToRecord, KV } from "@/components/KeyValueEditor";
import RequestRunner, { TableView, resolveArray } from "@/components/RequestRunner";
import Select from "@/components/Select";
import TagInput from "@/components/TagInput";
import CurlImport from "@/components/CurlImport";
import { buildCurl } from "@/lib/curl";
import { parseCurl } from "@/lib/curlParse";

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
  const {
    activeProjectId, activeEnvironmentId,
    pendingEndpointId, setPendingEndpointId,
    endpointRunStatus,
  } = useAppStore();
  const searchRef = useRef<HTMLInputElement>(null);
  const [keyword, setKeyword] = useState("");
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [methodFilter, setMethodFilter] = useState<string>("");
  const [curlOpen, setCurlOpen] = useState(false);
  const [tagExpand, setTagExpand] = useState(false);
  const [curlPrefill, setCurlPrefill] = useState<Partial<ReturnType<typeof makeDraft>> | null>(null);

  // Consume pendingEndpointId set by CommandPalette → auto-select the endpoint
  useEffect(() => {
    if (pendingEndpointId) {
      setSelectedId(pendingEndpointId);
      setPendingEndpointId(null);
    }
  }, [pendingEndpointId, setPendingEndpointId]);

  const { data: endpoints = [], isLoading: endpointsLoading } = useQuery({
    queryKey: ["endpoints", activeProjectId],
    queryFn: () =>
      activeProjectId
        ? api.get<Endpoint[]>(`/api/endpoints?projectId=${activeProjectId}`)
        : Promise.resolve([]),
    enabled: !!activeProjectId,
    staleTime: 30_000,
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

  const listStarMut = useMutation({
    mutationFn: ({ id, starred }: { id: string; starred: boolean }) =>
      api.patch<Endpoint>(`/api/endpoints/${id}`, { starred }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["endpoints", activeProjectId] }),
    onError: (e: Error) => toast.error("星标更新失败：" + e.message),
  });

  const toggleStar = useCallback((id: string, starred: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    listStarMut.mutate({ id, starred: !starred });
  }, [listStarMut]);

  // Collect all variable names from active environment for autocomplete
  const variableSuggestions = useMemo(() => {
    const activeEnv = envs.find((e) => e.id === activeEnvironmentId);
    if (!activeEnv) return [];
    try {
      const vars = JSON.parse(activeEnv.variables);
      return Object.keys(vars).sort();
    } catch {
      return [];
    }
  }, [envs, activeEnvironmentId]);

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
    const arr = endpoints.filter((e) => {
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
    return arr.sort((a, b) => {
      const aS = !!a.starred;
      const bS = !!b.starred;
      if (aS && !bS) return -1;
      if (!aS && bS) return 1;
      return a.name.localeCompare(b.name);
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

  const selected = selectedId ? (endpoints.find((e) => e.id === selectedId) ?? null) : null;

  const toggleTag = (t: string) => {
    const next = new Set(activeTags);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setActiveTags(next);
  };

  // ⌘F → focus search box
  useShortcut("f", () => searchRef.current?.focus(), { cmdOrCtrl: true });

  const handleCopy = () => {
    if (!selected) return;
    const { id: _id, ...rest } = makeDraft(selected, activeProjectId!);
    setCurlPrefill({ ...rest, name: `副本 - ${selected.name}` });
    setSelectedId(null);
    setEditOpen(true);
  };

  if (!activeProjectId) {
    return (
      <div className="p-8">
        <Empty
          title="请先选择或创建项目"
          hint="接口、环境都是以项目为单位管理的。已有项目可在顶部选择，新项目可先到项目页配置。"
          action={
            <Link to="/projects" className="btn-primary">
              <Plus className="w-4 h-4" />
              去项目页
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="h-full grid md:grid-cols-[320px_1fr]">
      <div className={`border-r border-black/[0.06] dark:border-white/5 bg-white/30 dark:bg-bg-panel/30 flex flex-col min-h-0 ${selected ? "hidden md:flex" : "flex"}`}>
        <div className="p-3 border-b border-black/[0.06] dark:border-white/5 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchRef}
                className="input pl-8"
                placeholder="搜索名称/路径/标签"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <button
              className="btn-primary gap-1.5 px-3 text-xs shrink-0"
              onClick={() => { setCurlPrefill(null); setSelectedId(null); setEditOpen(true); }}
            >
              <Plus className="w-3.5 h-3.5" /> 新建
            </button>
            <button
              className="btn-ghost gap-1.5 px-2.5 text-xs shrink-0"
              onClick={() => setCurlOpen(true)}
              title="粘贴 curl 命令快速创建接口"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">curl 导入</span>
            </button>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Select
              value={methodFilter}
              onChange={setMethodFilter}
              options={METHODS.map((m) => ({ value: m, label: m }))}
              placeholder="全部方法"
              className="text-xs w-[110px]"
            />
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
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>
              {endpointsLoading ? "正在读取接口" : `显示 ${filtered.length} / ${endpoints.length} 个接口`}
            </span>
            {(keyword || methodFilter || activeTags.size > 0) && (
              <span className="text-brand-glow">筛选中</span>
            )}
          </div>
          {allTags.length > 0 && (
            <div className="pt-1">
              <div
                className={`flex items-center gap-1.5 flex-wrap overflow-y-auto ${
                  tagExpand ? "max-h-none" : "max-h-[72px]"
                }`}
              >
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
              {allTags.length > 10 && (
                <button
                  className="text-[11px] text-brand-glow hover:underline mt-1"
                  onClick={() => setTagExpand(!tagExpand)}
                >
                  {tagExpand ? "收起标签" : `展开全部标签（共 ${allTags.length} 个）`}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-2">
          {endpointsLoading ? (
            <div className="space-y-2 p-2" aria-label="接口加载中">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-lg bg-bg-elevated/35 p-3 space-y-2">
                  <div className="skeleton-line w-2/3" />
                  <div className="skeleton-line w-full" />
                </div>
              ))}
            </div>
          ) : endpoints.length === 0 ? (
            <Empty
              icon={<Activity className="w-5 h-5" />}
              title="还没有接口"
              hint="点击右上角「新建」创建第一个接口，或使用 curl 导入。"
              action={
                <button
                  className="btn-primary text-sm"
                  onClick={() => { setCurlPrefill(null); setSelectedId(null); setEditOpen(true); }}
                >
                  <Plus className="w-4 h-4" /> 新建接口
                </button>
              }
            />
          ) : filtered.length === 0 ? (
            <Empty icon={<Activity className="w-5 h-5" />} title="暂无匹配接口" hint="尝试调整搜索关键词或筛选条件" />
          ) : (
            <>{grouped.map(([tag, items]) => (
              <div key={tag}>
                <div className="px-2 pt-3 pb-1 section-label flex items-center gap-1.5">
                  <TagIcon className="w-3 h-3 shrink-0" />
                  {tag === UNTAGGED ? "未分组" : tag}
                  <span className="opacity-60 font-normal normal-case tracking-normal text-[11px]">({items.length})</span>
                </div>
                {items.map((ep) => {
                  const rs = endpointRunStatus[ep.id];
                  const dotColor = rs
                    ? rs.status >= 200 && rs.status < 300
                      ? "bg-emerald-400"
                      : rs.status === 0
                      ? "bg-rose-400"
                      : "bg-amber-400"
                    : null;
                  const isStarred = !!ep.starred;
                  return (
                    <div
                      key={ep.id}
                      onClick={() => setSelectedId(ep.id)}
                      className={`w-full text-left px-2 py-2 rounded-md my-0.5 transition-colors cursor-pointer flex items-center gap-1 ${
                        selected?.id === ep.id
                          ? "bg-brand/15 ring-1 ring-brand/30"
                          : "hover:bg-bg-hover/50"
                      }`}
                    >
                      <button
                        className="shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors"
                        onClick={(e) => toggleStar(ep.id, isStarred, e)}
                        disabled={listStarMut.isPending}
                        title={isStarred ? "取消星标" : "加入星标"}
                      >
                        <Star className={`w-3.5 h-3.5 ${isStarred ? "text-amber-400 fill-current" : "text-slate-600"}`} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <MethodBadge method={ep.method} />
                          <span className="text-sm text-white truncate flex-1">{ep.name}</span>
                          {dotColor && (
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`}
                              title={rs?.status ? `HTTP ${rs.status}` : "执行失败"}
                            />
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 truncate">{ep.path}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}</>
          )}
        </div>
      </div>

      <div className={`overflow-auto ${!selected ? "hidden md:block" : "block"}`}>
        {selected ? (
          <EndpointDetail
            endpoint={selected}
            environmentId={activeEnvironmentId}
            projectId={activeProjectId}
            onEdit={() => setEditOpen(true)}
            onDeleted={() => setSelectedId(null)}
            onCopy={handleCopy}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <div className="hidden md:flex h-full">
            <Empty title="选择左侧接口查看详情" />
          </div>
        )}
      </div>

      <EndpointEditor
        open={editOpen}
        endpoint={selectedId && editOpen && !curlPrefill ? selected : null}
        projectId={activeProjectId}
        existingTags={allTags.filter(([t]) => t !== UNTAGGED).map(([t]) => t)}
        variableSuggestions={variableSuggestions}
        prefill={curlPrefill ?? undefined}
        onClose={() => { setEditOpen(false); setCurlPrefill(null); }}
        onSaved={(id) => {
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

function ParamTable({ data }: { data: Record<string, string> }) {
  const rows = Object.entries(data);
  if (!rows.length) return <span className="text-xs text-slate-500">（空）</span>;
  return (
    <table className="w-full text-xs">
      <tbody className="divide-y divide-white/5">
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td className="py-1.5 pr-4 font-mono text-brand-glow whitespace-nowrap w-1/3">{k}</td>
            <td className="py-1.5 font-mono text-slate-300 break-all">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FormBodyTable({ body }: { body: string }) {
  const rows = body.split("&").map((p) => {
    const eq = p.indexOf("=");
    return eq === -1 ? { k: p, v: "" } : { k: p.slice(0, eq), v: p.slice(eq + 1) };
  }).filter((r) => r.k.trim());
  if (!rows.length) return <span className="text-xs text-slate-500">（空）</span>;
  return (
    <table className="w-full text-xs">
      <tbody className="divide-y divide-white/5">
        {rows.map(({ k, v }, i) => (
          <tr key={i}>
            <td className="py-1.5 pr-4 font-mono text-brand-glow whitespace-nowrap w-1/3">{k}</td>
            <td className="py-1.5 font-mono text-slate-300 break-all">{v || <span className="text-slate-500">（空）</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div>
      <button
        className="w-full flex items-center gap-1.5 section-label mb-2 hover:text-slate-700 dark:hover:text-slate-100 transition-colors group"
        onClick={() => setCollapsed((v) => !v)}
      >
        <ChevronDown className={`w-3 h-3 shrink-0 text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
        {label}
      </button>
      {!collapsed && (
        <div className="rounded-lg bg-bg-elevated/50 px-3 py-2.5 border border-white/5">{children}</div>
      )}
    </div>
  );
}

function EndpointDetail({
  endpoint,
  environmentId,
  projectId,
  onEdit,
  onDeleted,
  onCopy,
  onBack,
}: {
  endpoint: Endpoint;
  environmentId: string | null;
  projectId: string | null;
  onEdit: () => void;
  onDeleted: () => void;
  onCopy: () => void;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: (id: string) => api.del(`/api/endpoints/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["endpoints"] });
      toast.success("已删除");
      onDeleted();
    },
    onError: (e: Error) => toast.error("删除失败：" + e.message),
  });
  const starMut = useMutation({
    mutationFn: (starred: boolean) => api.patch<Endpoint>(`/api/endpoints/${endpoint.id}`, { starred }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["endpoints"] }),
    onError: (e: Error) => toast.error("操作失败：" + e.message),
  });

  const tags = parseTags(endpoint.tags);
  const query = safeJson(endpoint.query, {}) as Record<string, string>;
  const headers = safeJson(endpoint.headers, {}) as Record<string, string>;
  const extract = safeJson(endpoint.extract, {}) as Record<string, string>;
  const hasQuery = Object.keys(query).length > 0;
  const hasHeaders = Object.keys(headers).length > 0;
  const hasBody = endpoint.body && endpoint.body.trim();
  const hasExtract = Object.keys(extract).length > 0;

  // ── Response panel state ────────────────────────────────────────────────────
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [resultTab, setResultTab] = useState<string>("body");
  const [copied, setCopied] = useState(false);
  const [responseFullscreen, setResponseFullscreen] = useState(false);
  const [headersWrap, setHeadersWrap] = useState(false);
  const [bodyRawMode, setBodyRawMode] = useState(false);
  const [responsePanelCollapsed, setResponsePanelCollapsed] = useState(false);

  // ── 2.2 Build curl ──────────────────────────────────────────────────────────
  const { data: envList = [] } = useQuery({
    queryKey: ["environments", projectId ?? ""],
    queryFn: () => api.get<Environment[]>("/api/environments?projectId=" + projectId),
    enabled: !!projectId,
  });
  const currentEnv = envList.find((e) => e.id === environmentId) ?? null;

  const handleCopyCurl = async () => {
    const curl = buildCurl({
      method: endpoint.method,
      url: currentEnv
        ? currentEnv.baseUrl.replace(/\/$/, "") + "/" + endpoint.path.replace(/^\//, "")
        : endpoint.path,
      headers: safeJson(endpoint.headers, {}) as Record<string, string>,
      body: endpoint.body || null,
    });
    try {
      await navigator.clipboard.writeText(curl);
      setCopied(true);
      toast.success("curl 命令已复制");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败");
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Mobile sticky back bar */}
      <div className="md:hidden sticky top-0 z-10 flex items-center bg-white/80 dark:bg-bg-panel/90 backdrop-blur border-b border-black/[0.06] dark:border-white/5 px-3 py-2 shrink-0">
        <button className="btn-ghost text-sm pl-0" onClick={onBack} aria-label="返回列表">
          <ChevronLeft className="w-4 h-4" /> 返回列表
        </button>
      </div>
      {/* ── Top: params area (scrollable) ── */}
      <div className="overflow-auto space-y-5 p-4 md:p-6" style={{ flex: runResult ? "1 1 0%" : "1 1 0%" }}>

        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-3">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <MethodBadge method={endpoint.method} />
                <h2 className="text-lg font-semibold text-white">{endpoint.name}</h2>
                {tags.map((t) => (
                  <span key={t} className="chip bg-brand/10 text-brand text-[11px]">{t}</span>
                ))}
              </div>
              {endpoint.description && <p className="text-sm text-slate-400">{endpoint.description}</p>}
              <code className="text-xs font-mono text-slate-300 bg-bg-elevated/60 px-2 py-1 rounded break-all block">{endpoint.path}</code>
            </div>
          </div>
          {/* Action buttons — wrap on mobile */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              className={`btn-ghost text-xs ${endpoint.starred ? "text-amber-400" : ""}`}
              onClick={() => !starMut.isPending && starMut.mutate(!endpoint.starred)}
              title={endpoint.starred ? "取消星标" : "加入星标"}
            >
              <Star className={`w-3.5 h-3.5 ${endpoint.starred ? "fill-current" : ""}`} />
            </button>
            <button className="btn-ghost text-xs" onClick={handleCopyCurl} title={copied ? "已复制" : "复制为 curl 命令"}>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Terminal className="w-3.5 h-3.5" />} curl
            </button>
            <button className="btn-ghost text-xs" onClick={onCopy} title="复制为新接口">
              <Copy className="w-3.5 h-3.5" /> 复制
            </button>
            <button className="btn-ghost text-xs" onClick={onEdit}>
              <Edit3 className="w-3.5 h-3.5" /> 编辑
            </button>
            <button
              className="btn-danger text-xs"
              disabled={del.isPending}
              onClick={() => {
                if (confirm(`删除接口「${endpoint.name}」？此操作不可恢复。`)) del.mutate(endpoint.id);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" /> {del.isPending ? "删除中…" : "删除"}
            </button>
          </div>
        </div>

        {/* Parameters overview */}
        {(hasQuery || hasHeaders || hasBody || hasExtract) && (
          <div className="space-y-3">
            {hasQuery && (
              <Section label="Query 参数">
                <ParamTable data={query} />
              </Section>
            )}
            {hasHeaders && (
              <Section label="请求头">
                <ParamTable data={headers} />
              </Section>
            )}
            {hasBody && (
              <Section label={`Body（${endpoint.bodyType}）`}>
                {endpoint.bodyType === "form" ? (
                  <FormBodyTable body={endpoint.body} />
                ) : (
                  <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap break-all max-h-48 overflow-auto">
                    {endpoint.body}
                  </pre>
                )}
              </Section>
            )}
            {hasExtract && (
              <Section label="变量提取">
                <ParamTable data={extract} />
              </Section>
            )}
          </div>
        )}

        {/* Runner */}
        <RequestRunner endpoint={endpoint} environmentId={environmentId} projectId={projectId} onResult={setRunResult} />
      </div>

      {/* ── Bottom: Response panel (flexible) ── */}
      {runResult && (
        <div
          className="border-t border-black/10 dark:border-white/5 bg-bg-panel flex flex-col min-h-0"
          style={
            responsePanelCollapsed
              ? { flex: "0 0 auto", overflow: "hidden" }
              : { flex: "1.8 1 0%", minHeight: "50vh", maxHeight: "88vh", resize: "vertical", overflow: "hidden" }
          }
        >
          {/* Status summary row */}
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-black/10 dark:border-white/5 bg-white/[0.02] shrink-0">
            <div className="flex items-center gap-3">
              <span className={`font-mono text-xs font-bold ${statusClass(runResult.status)}`}>{runResult.status}</span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {runResult.durationMs}ms
              </span>
              {runResult.error && (
                <span className="text-xs text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />{runResult.error}
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              <button
                className="btn-ghost p-1"
                onClick={() => setResponsePanelCollapsed((v) => !v)}
                title={responsePanelCollapsed ? "展开响应面板" : "折叠响应面板"}
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${responsePanelCollapsed ? "-rotate-90" : ""}`} />
              </button>
              <button
                className="btn-ghost p-1"
                onClick={() => setResponseFullscreen(true)}
                title="全屏查看响应"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!responsePanelCollapsed && (
            <>
              {/* Tab bar */}
              <div className="flex items-center gap-0.5 px-4 py-1 border-b border-black/10 dark:border-white/5 bg-white/[0.02] flex-wrap shrink-0">
                {[
                  { key: "body", label: "响应体" },
                  { key: "headers", label: "响应头" },
                  ...(Object.keys(runResult.extracted ?? {}).length > 0 ? [{ key: "extract" as const, label: "变量提取" }] : []),
                  { key: "log", label: "请求日志" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setResultTab(tab.key)}
                    className={`text-xs px-2.5 py-1 rounded transition-colors ${
                      resultTab === tab.key
                        ? "bg-brand/15 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
                {/* 响应体：原始/表格切换（仅当响应为数组时显示） */}
                {resultTab === "body" && resolveArray(runResult.responseBody) && (
                  <button
                    className="ml-auto text-xs px-2 py-1 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    onClick={() => setBodyRawMode((v) => !v)}
                    title={bodyRawMode ? "切换为表格视图" : "切换为原始 JSON"}
                  >
                    {bodyRawMode ? "表格" : "原始"}
                  </button>
                )}
                {resultTab === "headers" && (
                  <button
                    className="ml-auto text-xs px-2 py-1 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    onClick={() => setHeadersWrap((v) => !v)}
                    title={headersWrap ? "取消自动换行" : "开启自动换行"}
                  >
                    {headersWrap ? "不换行" : "换行"}
                  </button>
                )}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-auto min-h-0">
                {resultTab === "body" && (() => {
                  const bodyRaw = runResult.responseBody;
                  const rows = resolveArray(bodyRaw);
                  if (!bodyRawMode && rows && rows.length > 0) {
                    return (
                      <div className="p-3">
                        <TableView
                          rows={rows}
                          projectId={projectId}
                          environmentId={environmentId}
                          onRefresh={() => {}}
                        />
                      </div>
                    );
                  }
                  return (
                    <pre className="text-xs font-mono whitespace-pre-wrap break-all text-slate-200 p-3">
                      {typeof bodyRaw === "string"
                        ? bodyRaw
                        : JSON.stringify(bodyRaw, null, 2)}
                    </pre>
                  );
                })()}
                {resultTab === "headers" && (
                  <pre className={`text-xs font-mono text-slate-200 p-3 ${headersWrap ? "whitespace-pre-wrap break-all" : "whitespace-pre overflow-x-auto"}`}>
                    {JSON.stringify(runResult.responseHeaders, null, 2)}
                  </pre>
                )}
                {resultTab === "extract" && (
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all text-slate-200 p-3">
                    {JSON.stringify(runResult.extracted, null, 2)}
                  </pre>
                )}
                {resultTab === "log" && (
                  <div className="font-mono text-xs text-slate-300 space-y-0.5 p-3">
                    {runResult.scriptLog?.length ? (
                      runResult.scriptLog.map((line, i) => <div key={i}>{line}</div>)
                    ) : (
                      <span className="text-slate-500">无脚本输出</span>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Fullscreen response modal ── */}
      {runResult && (
        <Modal
          open={responseFullscreen}
          onClose={() => setResponseFullscreen(false)}
          title={`响应 · HTTP ${runResult.status} · ${runResult.durationMs}ms`}
          width="max-w-5xl"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-0.5 flex-wrap">
              {[
                { key: "body", label: "响应体" },
                { key: "headers", label: "响应头" },
                ...(Object.keys(runResult.extracted ?? {}).length > 0 ? [{ key: "extract" as const, label: "变量提取" }] : []),
                { key: "log", label: "请求日志" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setResultTab(tab.key)}
                  className={`text-xs px-2.5 py-1.5 rounded transition-colors ${
                    resultTab === tab.key ? "bg-brand/15 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              {resultTab === "body" && resolveArray(runResult.responseBody) && (
                <button
                  className="ml-auto text-xs px-2 py-1 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                  onClick={() => setBodyRawMode((v) => !v)}
                >
                  {bodyRawMode ? "表格" : "原始"}
                </button>
              )}
              {resultTab === "headers" && (
                <button
                  className="ml-auto text-xs px-2 py-1 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                  onClick={() => setHeadersWrap((v) => !v)}
                >
                  {headersWrap ? "不换行" : "换行"}
                </button>
              )}
            </div>
            {resultTab === "body" && (() => {
              const bodyRaw = runResult.responseBody;
              const rows = resolveArray(bodyRaw);
              if (!bodyRawMode && rows && rows.length > 0) {
                return <TableView rows={rows} projectId={projectId} environmentId={environmentId} onRefresh={() => {}} />;
              }
              return (
                <pre className="text-xs font-mono whitespace-pre-wrap break-all text-slate-200 bg-bg-elevated/40 rounded-lg p-4" style={{ minHeight: "55vh" }}>
                  {typeof bodyRaw === "string" ? bodyRaw : JSON.stringify(bodyRaw, null, 2)}
                </pre>
              );
            })()}
            {resultTab === "headers" && (
              <pre className={`text-xs font-mono text-slate-200 bg-bg-elevated/40 rounded-lg p-4 ${headersWrap ? "whitespace-pre-wrap break-all" : "whitespace-pre overflow-x-auto"}`} style={{ minHeight: "55vh" }}>
                {JSON.stringify(runResult.responseHeaders, null, 2)}
              </pre>
            )}
            {resultTab === "extract" && (
              <pre className="text-xs font-mono whitespace-pre-wrap break-all text-slate-200 bg-bg-elevated/40 rounded-lg p-4" style={{ minHeight: "55vh" }}>
                {JSON.stringify(runResult.extracted, null, 2)}
              </pre>
            )}
            {resultTab === "log" && (
              <div className="font-mono text-xs text-slate-300 space-y-0.5 bg-bg-elevated/40 rounded-lg p-4" style={{ minHeight: "55vh" }}>
                {runResult.scriptLog?.length ? (
                  runResult.scriptLog.map((line, i) => <div key={i}>{line}</div>)
                ) : (
                  <span className="text-slate-500">无脚本输出</span>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function EndpointEditor({
  open,
  endpoint,
  projectId,
  existingTags,
  variableSuggestions,
  prefill,
  onClose,
  onSaved,
}: {
  open: boolean;
  endpoint: Endpoint | null;
  projectId: string;
  existingTags: string[];
  variableSuggestions?: string[];
  prefill?: Partial<ReturnType<typeof makeDraft>>;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const isNew = !endpoint;
  const [form, setForm] = useState(() => ({ ...makeDraft(endpoint, projectId), ...(prefill ?? {}) }));
  const [initialForm, setInitialForm] = useState(() => ({ ...makeDraft(endpoint, projectId), ...(prefill ?? {}) }));
  const [confirmClose, setConfirmClose] = useState(false);
  const [tab, setTab] = useState<"params" | "headers" | "body" | "extract" | "pre" | "post">("params");
  const [curlText, setCurlText] = useState("");
  const [curlOpen, setCurlOpen] = useState(false);
  const [curlError, setCurlError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const draft = { ...makeDraft(endpoint, projectId), ...(prefill ?? {}) };
      setForm(draft);
      setInitialForm(draft);
      setConfirmClose(false);
      setCurlText(""); setCurlOpen(false); setCurlError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** True when user has made any change from the initial state. */
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  /** Safe close: show inline confirmation when there are unsaved edits. */
  const handleClose = useCallback(() => {
    if (isDirty) {
      setConfirmClose(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const applyCurl = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      const parsed = parseCurl(trimmed);
      // strip env baseUrl prefix if url is absolute
      const envBaseUrl = form.projectId ? undefined : undefined; // best-effort, no env context here
      const resolvedType = parsed.bodyType === "none" ? "json" : parsed.bodyType;
      setForm((prev) => ({
        ...prev,
        method: parsed.method,
        path: parsed.url,
        _headers: recordToRows(parsed.headers),
        _query: recordToRows(parsed.query),
        body: parsed.body,
        bodyType: resolvedType,
        _formBody: resolvedType === "form" ? parseFormBody(parsed.body) : prev._formBody,
      }));
      setCurlOpen(false);
      setCurlError(null);
      setCurlText("");
    } catch (e: any) {
      setCurlError(e.message);
    }
  };

  const { data: allProjects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get<{ id: string; name: string }[]>("/api/projects"),
  });

  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        body: form.bodyType === "form"
          ? serializeFormBody(form._formBody as KV[])
          : form.body,
        headers: JSON.stringify(rowsToRecord(form._headers as KV[])),
        query: JSON.stringify(rowsToRecord(form._query as KV[])),
        extract: JSON.stringify(rowsToRecord(form._extract as KV[])),
        tags: JSON.stringify(form._tags),
      };
      delete (payload as any)._headers;
      delete (payload as any)._query;
      delete (payload as any)._extract;
      delete (payload as any)._tags;
      delete (payload as any)._formBody;
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

  // ① Cmd+S → save when editor is open
  const handleSave = useCallback(() => {
    if (form.name && form.path && !save.isPending) save.mutate();
  }, [form.name, form.path, save]);
  useShortcut("s", handleSave, { cmdOrCtrl: true, enabled: open });
  // Escape → safe close (asks for confirmation when dirty)
  useShortcut("Escape", handleClose, { enabled: open });

  if (!open) return null;

  const suggested = existingTags.filter((t) => !form._tags.includes(t)).slice(0, 8);

  return (
    <Modal open={open} onClose={handleClose} title={isNew ? "新建接口" : "编辑接口"} width="max-w-3xl" disableBackdropClose>
      <div className="space-y-3">
        {/* Inline curl import */}
        {!curlOpen ? (
          <div className="flex justify-end">
            <button
              className="btn-ghost text-xs gap-1.5"
              onClick={() => { setCurlOpen(true); setCurlError(null); }}
            >
              <Terminal className="w-3.5 h-3.5" /> 从 curl 命令导入
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-brand/30 bg-brand/5 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-brand-glow" /> 粘贴 curl 命令
              </span>
              <button className="btn-ghost p-1" onClick={() => { setCurlOpen(false); setCurlError(null); setCurlText(""); }}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <textarea
              className="input font-mono text-xs min-h-[90px] resize-y"
              placeholder={"curl -X POST 'https://api.example.com/users' \\\n  -H 'Authorization: Bearer {{token}}' \\\n  -d '{\"name\":\"{{name}}\"}' "}
              value={curlText}
              autoFocus
              onChange={(e) => { setCurlText(e.target.value); setCurlError(null); }}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (text.trim().startsWith("curl")) {
                  e.preventDefault();
                  setCurlText(text);
                  setTimeout(() => applyCurl(text), 0);
                }
              }}
            />
            {curlError && (
              <div className="text-xs text-rose-300 bg-rose-500/10 rounded px-2 py-1.5">{curlError}</div>
            )}
            <div className="flex justify-end gap-2">
              <button className="btn-ghost text-xs" onClick={() => { setCurlOpen(false); setCurlError(null); setCurlText(""); }}>
                取消
              </button>
              <button className="btn-primary text-xs" disabled={!curlText.trim()} onClick={() => applyCurl(curlText)}>
                <Terminal className="w-3.5 h-3.5" /> 解析并填入
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-[120px_1fr] gap-2">
          <Select
            value={form.method}
            onChange={(v) => setForm({ ...form, method: v })}
            options={METHODS.map((m) => ({ value: m, label: m }))}
          />
          <div className="space-y-1">
            <input
              className={`input font-mono ${
                form.path && !form.path.match(/^(\/|https?:\/\/|\{\{)/)
                  ? "border-amber-500/50 focus:ring-amber-500/30"
                  : ""
              }`}
              value={form.path}
              onChange={(e) => setForm({ ...form, path: e.target.value })}
              placeholder="/api/users/{{userId}}"
            />
            {form.path && !form.path.match(/^(\/|https?:\/\/|\{\{)/) && (
              <div className="text-[11px] text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> 路径建议以 / 开头，或填写完整的 https:// URL
              </div>
            )}
          </div>
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
            <Select
              value={form.projectId}
              onChange={(v) => setForm({ ...form, projectId: v })}
              options={allProjects.map((p) => ({ value: p.id, label: p.name }))}
              className="text-xs flex-1"
            />
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

        <div className="flex gap-0.5 flex-wrap border-b border-white/5 pb-1">
          {(["params", "headers", "body", "extract", "pre", "post"] as const).map((t) => (
            <button
              key={t}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                tab === t
                  ? "bg-brand/20 text-brand dark:text-brand-glow ring-1 ring-brand/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
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
            variableSuggestions={variableSuggestions}
          />
        )}
        {tab === "headers" && (
          <KeyValueEditor
            rows={form._headers as KV[]}
            onChange={(r) => setForm({ ...form, _headers: r })}
            keyPlaceholder="Header 名"
            valuePlaceholder="值（支持 {{var}}）"
            variableSuggestions={variableSuggestions}
          />
        )}
        {tab === "body" && (
          <div className="space-y-2">
            <div className="flex gap-2 items-center text-xs text-slate-400">
              <span>类型</span>
              <Select
                value={form.bodyType}
                onChange={(next) => {
                  if (next === "form") {
                    setForm({ ...form, bodyType: next, _formBody: parseFormBody(form.body) });
                  } else if (form.bodyType === "form") {
                    setForm({ ...form, bodyType: next, body: serializeFormBody(form._formBody as KV[]) });
                  } else {
                    setForm({ ...form, bodyType: next });
                  }
                }}
                options={[
                  { value: "json", label: "json" },
                  { value: "form", label: "form-urlencoded" },
                  { value: "text", label: "text" },
                  { value: "none", label: "none" },
                ]}
                className="text-xs w-40"
              />
            </div>
            {form.bodyType === "form" ? (
              <KeyValueEditor
                rows={form._formBody as KV[]}
                onChange={(r) => setForm({ ...form, _formBody: r })}
                keyPlaceholder="字段名"
                valuePlaceholder="值（支持 {{var}}）"
                variableSuggestions={variableSuggestions}
              />
            ) : (
              <JsonEditor
                value={form.body}
                onChange={(v) => setForm({ ...form, body: v })}
                height={220}
                language={form.bodyType === "json" ? "json" : "plaintext"}
              />
            )}
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
          <button className="btn-ghost" onClick={handleClose}>取消</button>
          <button
            className="btn-primary"
            disabled={!form.name || !form.path || save.isPending}
            onClick={() => save.mutate()}
          >
            <Save className="w-4 h-4" />
            {save.isPending ? "保存中…" : "保存"}
          </button>
        </div>
      </div>

      {/* ── Unsaved changes confirmation overlay ── */}
      {confirmClose && (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center rounded-xl">
          <div className="bg-bg-panel rounded-xl p-6 max-w-sm mx-4 shadow-2xl border border-white/10">
            <h3 className="text-sm font-medium mb-2">有未保存的修改</h3>
            <p className="text-xs text-slate-400 mb-4">确定放弃所有更改吗？</p>
            <div className="flex justify-end gap-2">
              <button
                className="btn-ghost text-xs px-3 py-1.5"
                onClick={() => setConfirmClose(false)}
              >
                继续编辑
              </button>
              <button
                className="text-xs px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors"
                onClick={() => { setConfirmClose(false); onClose(); }}
              >
                放弃
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function parseFormBody(body: string): KV[] {
  if (!body.trim()) return [];
  return body.split("&").map((p) => {
    const eq = p.indexOf("=");
    return eq === -1 ? { key: p, value: "" } : { key: p.slice(0, eq), value: p.slice(eq + 1) };
  }).filter((r) => r.key.trim());
}

function serializeFormBody(rows: KV[]): string {
  return rows.filter((r) => r.key.trim()).map((r) => `${r.key}=${r.value}`).join("&");
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
    starred: ep?.starred ?? false,
    _tags: parseTags(ep?.tags),
    _headers: recordToRows(safeJson(ep?.headers, {}) as Record<string, string>),
    _query: recordToRows(safeJson(ep?.query, {}) as Record<string, string>),
    _extract: recordToRows(safeJson(ep?.extract, {}) as Record<string, string>),
    _formBody: parseFormBody(ep?.bodyType === "form" ? (ep?.body ?? "") : ""),
  };
}

function tabLabel(t: string) {
  return {
    params: "Query 参数", headers: "请求头", body: "Body",
    extract: "变量提取", pre: "前置脚本", post: "后置脚本",
  }[t] ?? t;
}
