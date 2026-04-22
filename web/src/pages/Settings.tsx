import { useRef, useState } from "react";
import { Github, Server, Info, Download, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

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
    <div className="p-8 space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-white">设置</h1>
        <p className="text-sm text-slate-400 mt-1">数据管理与部署信息。</p>
      </div>

      {/* Export / Import */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 text-slate-300">
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

      <div className="card p-5 space-y-2">
        <div className="flex items-center gap-2 text-slate-300">
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
        <div className="flex items-center gap-2 text-slate-300">
          <Info className="w-4 h-4" />
          <span className="font-medium">关于</span>
        </div>
        <div className="text-sm text-slate-400 leading-relaxed">
          OpsPilot 是本地/自托管的可视化运维助手，统一管理 HTTP 接口并支持多接口串联编排。
          所有数据保存在服务器本地 SQLite 文件中。
        </div>
      </div>

      <div className="card p-5 space-y-2">
        <div className="flex items-center gap-2 text-slate-300">
          <Github className="w-4 h-4" />
          <span className="font-medium">版本控制</span>
        </div>
        <div className="text-sm text-slate-400">
          项目使用 git 管理，修改前建议先提交一次快照以便回滚。
        </div>
      </div>
    </div>
  );
}
