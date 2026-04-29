import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, Project, Environment } from "@/lib/api";
import { useAppStore } from "@/store/app";
import { safeJson } from "@/lib/utils";
import { Globe2, FolderKanban, Code2, X, Search } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import Select from "./Select";

/** ④ Popover showing the active environment's baseUrl + variables */
function EnvVarPopover({
  env,
  onClose,
}: {
  env: Environment;
  onClose: () => void;
}) {
  const vars = safeJson(env.variables, {}) as Record<string, string>;
  const envEntries = Object.entries(vars);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full right-0 mt-2 w-[min(20rem,calc(100vw-1rem))] z-50 rounded-xl border border-black/[0.08] dark:border-white/10 bg-white dark:bg-bg-panel shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/[0.06] dark:border-white/5">
        <div>
          <div className="text-xs font-medium text-stone-900 dark:text-white">{env.name}</div>
          <div className="text-[11px] font-mono text-brand-glow truncate">{env.baseUrl}</div>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-stone-900 dark:hover:text-white transition-colors" aria-label="关闭环境变量面板">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Variables */}
      <div className="max-h-64 overflow-auto">
        {envEntries.length === 0 ? (
          <div className="px-4 py-5 text-center text-xs text-slate-500">
            暂无变量。在项目 → 环境中添加变量后可在接口中用{" "}
            <code className="text-brand-glow">{"{{变量名}}"}</code> 引用。
          </div>
        ) : (
          <table className="w-full text-xs">
            <tbody className="divide-y divide-black/[0.06] dark:divide-white/5">
              {envEntries.map(([k, v]) => (
                <tr key={k} className="hover:bg-black/[0.03] dark:hover:bg-white/3 transition-colors">
                  <td className="px-4 py-2 font-mono text-brand-glow whitespace-nowrap w-2/5">{k}</td>
                  <td className="px-4 py-2 font-mono text-slate-300 truncate max-w-0" title={String(v)}>
                    {String(v)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="px-4 py-2 border-t border-black/[0.06] dark:border-white/5 text-[10px] text-slate-600">
        {envEntries.length} 个变量 · 在项目页面编辑环境可修改
      </div>
    </div>
  );
}

export default function TopBar() {
  const { activeProjectId, activeEnvironmentId, setActiveProject, setActiveEnvironment } = useAppStore();
  const [envVarOpen, setEnvVarOpen] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get<Project[]>("/api/projects"),
  });
  const { data: envs = [] } = useQuery({
    queryKey: ["environments", activeProjectId],
    queryFn: () =>
      activeProjectId
        ? api.get<Environment[]>(`/api/environments?projectId=${activeProjectId}`)
        : Promise.resolve([]),
    enabled: !!activeProjectId,
  });

  const activeEnv = envs.find((e) => e.id === activeEnvironmentId) ?? null;

  // Close env popover when environment changes
  useEffect(() => { setEnvVarOpen(false); }, [activeEnvironmentId]);

  return (
    <div className="min-h-14 border-b border-black/[0.06] dark:border-white/5 bg-white/72 dark:bg-bg-panel/45 backdrop-blur-xl flex items-center px-3 md:px-5 py-2 gap-2 md:gap-3 shrink-0 flex-wrap">
      {/* Project selector */}
      <div className="flex items-center gap-1.5 min-w-0">
        <FolderKanban className="w-3.5 h-3.5 text-stone-400 dark:text-slate-400 shrink-0" />
        <Select
          value={activeProjectId ?? ""}
          onChange={(val) => setActiveProject(val || null)}
          options={projects.map((p) => ({ value: p.id, label: p.name }))}
          placeholder="选择项目…"
          className="text-xs md:text-sm w-[132px] sm:w-[180px]"
        />
      </div>

      {/* Environment selector + ④ variable quick-view */}
      <div className="flex items-center gap-1 min-w-0">
        <Globe2 className="w-3.5 h-3.5 text-stone-400 dark:text-slate-400 shrink-0" />
        <Select
          value={activeEnvironmentId ?? ""}
          onChange={(val) => setActiveEnvironment(val || null)}
          options={envs.map((e) => ({ value: e.id, label: e.name }))}
          placeholder="选择环境…"
          disabled={!activeProjectId}
          className="text-xs md:text-sm w-[116px] sm:w-[160px]"
        />

        {/* ④ Env-var quick-view button */}
        {activeEnv && (
          <div className="relative">
            <button
              className={`btn-ghost p-1.5 transition-colors ${envVarOpen ? "text-brand-glow bg-brand/10" : "text-slate-400"}`}
              title="查看环境变量"
              onClick={() => setEnvVarOpen((v) => !v)}
            >
              <Code2 className="w-3.5 h-3.5" />
            </button>
            {envVarOpen && (
              <EnvVarPopover env={activeEnv} onClose={() => setEnvVarOpen(false)} />
            )}
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* ① Cmd+K hint — desktop only */}
      <button
        className="hidden lg:flex items-center gap-2 text-xs text-slate-500 hover:text-stone-900 dark:hover:text-slate-300 transition-colors border border-black/[0.07] dark:border-white/8 rounded-lg px-3 py-1.5 hover:border-brand/30 dark:hover:border-white/15"
        title="全局搜索接口 (⌘K)"
        onClick={() => {
          // dispatch synthetic keydown to trigger CommandPalette
          document.dispatchEvent(
            new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
          );
        }}
      >
        <Search className="w-3 h-3" />
        <span>搜索接口</span>
        <kbd className="font-mono text-[10px] border border-white/10 rounded px-1">⌘K</kbd>
      </button>

      <ThemeToggle />
    </div>
  );
}
