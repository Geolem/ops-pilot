import { useRef, useState, useEffect, useMemo } from "react";
import { GitBranch, Server, Info, Download, Upload, CheckCircle2, AlertTriangle, Tag as TagIcon, KeyRound, Copy } from "lucide-react";
import { toast } from "sonner";
import Select from "@/components/Select";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: boolean; stats?: Record<string, number>; err?: string } | null>(null);

  const handleExport = () => {
    const link = document.createElement("a");
    link.href = "/api/export";
    link.click();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "导入失败");
      setImportResult({ ok: true, stats: data.stats });
      toast.success("数据导入成功，刷新页面生效");
    } catch (err: any) {
      setImportResult({ ok: false, err: err.message });
      toast.error("导入失败：" + err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="page-shell space-y-5 max-w-3xl">
      <div>
        <h1 className="page-title">设置</h1>
        <p className="page-subtitle">数据管理、标签维护与部署信息。</p>
      </div>

      {/* Export / Import */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 panel-title">
          <Download className="w-4 h-4" />
          <span className="font-medium">数据备份 & 迁移</span>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">
          导出包含所有项目、环境、接口、编排流的 JSON 快照；
          在新实例上导入即可完成数据迁移（本地→Docker、本地→服务器）。
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <button className="btn-primary" onClick={handleExport}>
            <Download className="w-4 h-4" />
            导出全部数据
          </button>
          <button
            className="btn-ghost border border-white/10"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-4 h-4" />
            {importing ? "导入中…" : "从 JSON 文件导入"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
        {importResult && (
          <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
            importResult.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"
          }`}>
            {importResult.ok
              ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
            {importResult.ok
              ? <span>
                  导入成功：项目 {importResult.stats!.projects}，
                  环境 {importResult.stats!.environments}，
                  接口 {importResult.stats!.endpoints}，
                  编排 {importResult.stats!.flows}
                </span>
              : <span>{importResult.err}</span>
            }
          </div>
        )}
        <div className="text-xs text-slate-500 space-y-1 pt-1 border-t border-white/5">
          <div>迁移步骤：① 当前实例导出 JSON → ② 新实例启动后打开设置页 → ③ 导入 JSON</div>
          <div>也可直接拷贝 SQLite 文件：<code className="text-brand-glow">./data/ops-pilot.db</code></div>
        </div>
      </div>

      {/* Tag Management */}
      <TagPanel />

      <OtpPanel />

      <div className="card p-5 space-y-2">
        <div className="flex items-center gap-2 panel-title">
          <Server className="w-4 h-4" />
          <span className="font-medium">部署信息</span>
        </div>
        <div className="text-sm text-slate-400 space-y-1">
          <div>服务端口：<code className="text-brand-glow">5174</code>（生产）/ <code className="text-brand-glow">5173</code>（开发前端）</div>
          <div>数据目录：<code className="text-brand-glow">./data/ops-pilot.db</code>（SQLite）</div>
          <div>Docker 部署：<code className="text-brand-glow">docker compose up -d</code>，挂载 <code className="text-brand-glow">./data</code> 卷保持数据持久化</div>
        </div>
      </div>

      <div className="card p-5 space-y-2">
        <div className="flex items-center gap-2 panel-title">
          <Info className="w-4 h-4" />
          <span className="font-medium">关于</span>
        </div>
        <div className="text-sm text-slate-400 leading-relaxed">
          OpsPilot 是本地/自托管的可视化运维助手，统一管理 HTTP 接口并支持多接口串联编排。
          所有数据保存在服务器本地 SQLite 文件中。
        </div>
      </div>

      <div className="card p-5 space-y-2">
        <div className="flex items-center gap-2 panel-title">
          <GitBranch className="w-4 h-4" />
          <span className="font-medium">版本控制</span>
        </div>
        <div className="text-sm text-slate-400">
          项目使用 git 管理，修改前建议先提交一次快照以便回滚。
        </div>
      </div>
    </div>
  );
}

type ProjectItem = { id: string; name: string };
type EndpointItem = { id: string; tags: string };

function OtpPanel() {
  const { user, refresh } = useAuth();
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const startSetup = async () => {
    setLoading(true);
    try {
      const data = await api.post<{ secret: string; otpauthUri: string }>("/api/auth/otp/setup");
      setSetup(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    if (code.length !== 6) return;
    setLoading(true);
    try {
      await api.post("/api/auth/otp/verify", { code });
      await refresh();
      setSetup(null);
      setCode("");
      toast.success("OTP 已绑定");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label}已复制`);
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-300">
          <KeyRound className="w-4 h-4" />
          <span className="font-medium">OTP 绑定鉴权</span>
        </div>
        <span className={`status-badge ${user?.otpEnabled ? "status-badge-2xx" : "status-badge-4xx"}`}>
          {user?.otpEnabled ? "已绑定" : "未绑定"}
        </span>
      </div>

      <p className="text-sm text-slate-400 leading-relaxed">
        绑定后登录必须同时输入密码和认证器中的 6 位动态验证码。解绑或重置只能通过后台
        <code className="text-brand-glow mx-1">/api/admin/auth/otp/reset</code>
        接口完成。
      </p>

      {user?.otpEnabled ? (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          当前账号已启用 OTP。若手机遗失，请让后台管理员使用重置 token 清除绑定，重置会同时注销现有会话。
        </div>
      ) : setup ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-white/10 bg-black/5 dark:bg-black/20 p-3 space-y-2">
            <div className="text-xs text-slate-500">在 Google Authenticator、1Password、Microsoft Authenticator 等应用中手动添加密钥：</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-brand-glow text-sm break-all">{setup.secret}</code>
              <button className="btn-ghost p-2" title="复制密钥" onClick={() => copy(setup.secret, "密钥")}>
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] text-slate-500 break-all">{setup.otpauthUri}</code>
              <button className="btn-ghost p-2" title="复制 otpauth 链接" onClick={() => copy(setup.otpauthUri, "链接")}>
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              className="input max-w-[160px] font-mono tracking-widest"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
            />
            <button className="btn-primary" disabled={loading || code.length !== 6} onClick={verify}>
              验证并绑定
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-primary" disabled={loading} onClick={startSetup}>
          <KeyRound className="w-4 h-4" />
          生成绑定密钥
        </button>
      )}
    </div>
  );
}

function parseTagsLocal(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.map(String).filter(Boolean);
  } catch { /* ignore */ }
  return [];
}

function TagPanel() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [endpoints, setEndpoints] = useState<EndpointItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);

  const [renameTag, setRenameTag] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [mergeTag, setMergeTag] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState("");

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data: ProjectItem[]) => {
        setProjects(data);
        if (data.length > 0) setSelectedProjectId(data[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    setLoading(true);
    fetch(`/api/endpoints?projectId=${selectedProjectId}`)
      .then((r) => r.json())
      .then((data: EndpointItem[]) => {
        setEndpoints(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedProjectId]);

  const tagMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const ep of endpoints) {
      for (const t of parseTagsLocal(ep.tags)) {
        if (!map.has(t)) map.set(t, []);
        map.get(t)!.push(ep.id);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [endpoints]);

  const refreshEndpoints = async () => {
    if (!selectedProjectId) return;
    const data: EndpointItem[] = await fetch(`/api/endpoints?projectId=${selectedProjectId}`).then((r) => r.json());
    setEndpoints(data);
  };

  const batchPatch = async (
    oldTag: string,
    nextTagsFn: (current: string[]) => string[]
  ) => {
    setWorking(true);
    try {
      const affected = endpoints.filter((ep) => parseTagsLocal(ep.tags).includes(oldTag));
      const results = await Promise.allSettled(
        affected.map((ep) => {
          const next = nextTagsFn(parseTagsLocal(ep.tags));
          return fetch(`/api/endpoints/${ep.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tags: JSON.stringify(next) }),
          });
        })
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) toast.error(`${failed} 个接口更新失败，其余已完成`);
      await refreshEndpoints();
    } catch (err: any) {
      toast.error("操作失败：" + err.message);
    } finally {
      setWorking(false);
    }
  };

  const handleRename = async () => {
    if (!renameTag || !renameValue.trim()) return;
    const newName = renameValue.trim();
    await batchPatch(renameTag, (tags) => tags.map((t) => (t === renameTag ? newName : t)));
    toast.success(`标签「${renameTag}」已重命名为「${newName}」`);
    setRenameTag(null);
  };

  const handleMerge = async () => {
    if (!mergeTag || !mergeTarget) return;
    await batchPatch(mergeTag, (tags) => {
      const next = tags.filter((t) => t !== mergeTag);
      if (!next.includes(mergeTarget)) next.push(mergeTarget);
      return next;
    });
    toast.success(`标签「${mergeTag}」已合并到「${mergeTarget}」`);
    setMergeTag(null);
  };

  const handleDelete = async (tag: string) => {
    if (!confirm(`删除标签「${tag}」？这会从所有接口中移除该标签，操作不可恢复。`)) return;
    await batchPatch(tag, (tags) => tags.filter((t) => t !== tag));
    toast.success(`标签「${tag}」已删除`);
  };

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2 panel-title">
        <TagIcon className="w-4 h-4" />
        <span className="font-medium">标签管理</span>
      </div>
      <p className="text-sm text-slate-400">
        批量重命名、合并或删除接口标签。
      </p>

      {projects.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 shrink-0">项目</span>
          <Select
            value={selectedProjectId}
            onChange={(val) => setSelectedProjectId(val)}
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            className="text-xs"
          />
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400">加载中…</div>
      ) : tagMap.length === 0 ? (
        <div className="text-sm text-slate-500">该项目暂无标签</div>
      ) : (
        <div className="space-y-0.5">
          {tagMap.map(([tag, ids]) => (
            <div
              key={tag}
              className="soft-row flex items-center gap-2 py-2 px-2 group"
            >
              <span className="chip bg-brand/10 text-brand text-[11px] shrink-0">{tag}</span>
              <span className="flex-1 text-xs text-slate-500">{ids.length} 个接口</span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  className="btn-ghost text-xs px-2 py-1"
                  disabled={working}
                  onClick={() => { setRenameTag(tag); setRenameValue(tag); }}
                >
                  重命名
                </button>
                <button
                  className="btn-ghost text-xs px-2 py-1"
                  disabled={working || tagMap.length < 2}
                  onClick={() => { setMergeTag(tag); setMergeTarget(""); }}
                >
                  合并到
                </button>
                <button
                  className="text-xs px-2 py-1 rounded text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
                  disabled={working}
                  onClick={() => handleDelete(tag)}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rename dialog */}
      {renameTag && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-white dark:bg-bg-panel rounded-xl p-6 max-w-sm w-full mx-4 border border-black/[0.08] dark:border-white/10 shadow-2xl space-y-4">
            <h3 className="panel-title">重命名标签「{renameTag}」</h3>
            <input
              className="input w-full"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="新标签名"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
            />
            <div className="flex justify-end gap-2">
              <button className="btn-ghost text-xs" onClick={() => setRenameTag(null)}>取消</button>
              <button
                className="btn-primary text-xs"
                disabled={!renameValue.trim() || working}
                onClick={handleRename}
              >
                {working ? "处理中…" : "确认重命名"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge dialog */}
      {mergeTag && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-white dark:bg-bg-panel rounded-xl p-6 max-w-sm w-full mx-4 border border-black/[0.08] dark:border-white/10 shadow-2xl space-y-4">
            <h3 className="panel-title">
              合并标签「{mergeTag}」到另一个标签
            </h3>
            <p className="text-xs text-slate-400">
              所有带此标签的接口将改为目标标签（原标签被移除）。
            </p>
            <Select
              value={mergeTarget}
              onChange={(val) => setMergeTarget(val)}
              options={tagMap.filter(([t]) => t !== mergeTag).map(([t]) => ({ value: t, label: t }))}
              placeholder="选择目标标签…"
              className="w-full text-sm"
            />
            <div className="flex justify-end gap-2">
              <button className="btn-ghost text-xs" onClick={() => setMergeTag(null)}>取消</button>
              <button
                className="btn-primary text-xs"
                disabled={!mergeTarget || working}
                onClick={handleMerge}
              >
                {working ? "处理中…" : "确认合并"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
