import { useQuery } from "@tanstack/react-query";
import { api, Project, Environment } from "@/lib/api";
import { useAppStore } from "@/store/app";
import { Globe2, FolderKanban } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

export default function TopBar() {
  const { activeProjectId, activeEnvironmentId, setActiveProject, setActiveEnvironment } = useAppStore();
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

  return (
    <div className="h-14 border-b border-white/5 bg-bg-panel/40 backdrop-blur-lg flex items-center px-5 gap-4">
      <div className="flex items-center gap-2">
        <FolderKanban className="w-4 h-4 text-slate-400" />
        <select
          value={activeProjectId ?? ""}
          onChange={(e) => setActiveProject(e.target.value || null)}
          className="input py-1.5 min-w-[180px]"
        >
          <option value="">选择项目…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <Globe2 className="w-4 h-4 text-slate-400" />
        <select
          value={activeEnvironmentId ?? ""}
          onChange={(e) => setActiveEnvironment(e.target.value || null)}
          disabled={!activeProjectId}
          className="input py-1.5 min-w-[160px]"
        >
          <option value="">选择环境…</option>
          {envs.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1" />
      <ThemeToggle />
      <div className="text-xs text-slate-500 hidden md:block">
        提示：接口中使用 <span className="text-brand-glow font-mono">{"{{token}}"}</span> 等变量占位符，环境变量会在请求时自动注入
      </div>
    </div>
  );
}
