import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Boxes, Activity, Workflow, Zap, ArrowRight, Clock, AlertTriangle,
  CheckCircle2, XCircle, BarChart3, TrendingUp, RefreshCw, Terminal,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api, Project, RunResult } from "@/lib/api";
import { useAppStore } from "@/store/app";
import MethodBadge from "@/components/MethodBadge";
import { statusClass } from "@/lib/utils";

interface HistoryItem {
  id: string;
  method: string;
  url: string;
  status: number | null;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
  endpointId: string | null;
}

export default function DashboardPage() {
  const { activeProjectId } = useAppStore();

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get<Project[]>("/api/projects"),
  });
  const { data: history = [] } = useQuery({
    queryKey: ["dashboard-history"],
    queryFn: () => api.get<HistoryItem[]>("/api/history?limit=100"),
    refetchInterval: 10_000,
  });
  const active = projects.find((p) => p.id === activeProjectId);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const totalEndpoints = projects.reduce((acc, p) => acc + (p._count?.endpoints ?? 0), 0);
  const totalEnvironments = projects.reduce((acc, p) => acc + (p.environments?.length ?? 0), 0);
  const totalFlows = projects.reduce((acc, p) => acc + (p._count?.flows ?? 0), 0);

  // ── 7-day runs ──────────────────────────────────────────────────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentHistory = history.filter((h) => new Date(h.createdAt) >= sevenDaysAgo);
  const runStats = {
    total: recentHistory.length,
    success: recentHistory.filter((h) => h.status && h.status >= 200 && h.status < 400).length,
    failed: recentHistory.filter((h) => !h.status || h.status >= 400 || h.error).length,
    avgDuration: recentHistory.length
      ? Math.round(recentHistory.reduce((s, h) => s + (h.durationMs ?? 0), 0) / recentHistory.length)
      : 0,
  };

  // ── Last 5 runs ─────────────────────────────────────────────────────────────
  const lastFive = history.slice(0, 5);

  // ── Success rate bar ────────────────────────────────────────────────────────
  const successRate = runStats.total
    ? Math.round((runStats.success / runStats.total) * 100)
    : 100;

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-between"
      >
        <div>
          <h1 className="text-2xl font-semibold text-white">
            OpsPilot <span className="text-sm font-normal text-slate-500 ml-2">运维副驾驶</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {active
              ? `当前项目：${active.name}${active.description ? ` · ${active.description}` : ""}`
              : "在这里集中管理你的项目、环境和运维接口，告别手搓 curl。"}
          </p>
        </div>
        <Link
          to="/endpoints"
          className="hidden md:flex items-center gap-2 text-xs bg-brand/15 text-brand-glow px-3 py-1.5 rounded-lg hover:bg-brand/25 transition-colors"
        >
          <Terminal className="w-3.5 h-3.5" />
          去调试接口
          <ArrowRight className="w-3 h-3" />
        </Link>
      </motion.div>

      {/* ── Stats grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: "项目", value: projects.length, icon: Boxes, color: "from-brand to-accent" },
          { label: "接口", value: totalEndpoints, icon: Activity, color: "from-fuchsia-500 to-rose-400" },
          { label: "环境", value: totalEnvironments, icon: BarChart3, color: "from-cyan-400 to-teal-400" },
          { label: "编排", value: totalFlows, icon: Workflow, color: "from-amber-400 to-orange-500" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card p-4 relative overflow-hidden group"
          >
            <div
              className={`absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br ${s.color} opacity-20 blur-2xl group-hover:opacity-40 transition-opacity`}
            />
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <s.icon className="w-3.5 h-3.5" />
              {s.label}
            </div>
            <div className="text-2xl font-semibold text-white tracking-tight">{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* ── Middle section: 7d stats + quick start ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        {/* 7-day run stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-brand-glow" />
              <div className="font-medium text-white text-sm">近 7 天运行</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-white">{runStats.total}</div>
              <div className="text-[11px] text-slate-500">总次数</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-emerald-400">{runStats.success}</div>
              <div className="text-[11px] text-slate-500">成功</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-rose-400">{runStats.failed}</div>
              <div className="text-[11px] text-slate-500">失败</div>
            </div>
          </div>

          {/* Success rate bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">成功率</span>
              <span className="text-slate-300 font-medium">{successRate}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${successRate}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className={`h-full rounded-full transition-colors ${
                  successRate >= 90 ? "bg-emerald-500" : successRate >= 70 ? "bg-amber-500" : "bg-rose-500"
                }`}
              />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-white/5">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                平均耗时
              </span>
              <span className="font-mono text-slate-300">{runStats.avgDuration}ms</span>
            </div>
          </div>
        </motion.div>

        {/* Quick start / recent project */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" />
              <div className="font-medium text-white text-sm">快速开始</div>
            </div>
          </div>
          <ol className="space-y-2.5 text-xs text-slate-300">
            <Step n={1} done={projects.length > 0}>
              在 <Link to="/projects" className="text-brand-glow underline-offset-2 hover:underline">项目</Link> 里新建一个项目
            </Step>
            <Step n={2} done={!!active?.environments?.length}>
              为项目添加至少一个环境（dev / test / prod），填写 baseUrl
            </Step>
            <Step n={3} done={runStats.total > 0}>
              在 <Link to="/endpoints" className="text-brand-glow underline-offset-2 hover:underline">接口</Link> 创建接口模板并执行
            </Step>
            <Step n={4} done={totalFlows > 0}>
              将多个接口串成 <Link to="/flows" className="text-brand-glow underline-offset-2 hover:underline">编排</Link>，自动传参
            </Step>
          </ol>

          {/* Quick links */}
          {active && (
            <div className="mt-3 pt-3 border-t border-white/5 flex gap-2 flex-wrap">
              <Link to="/endpoints" className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-brand/10 text-brand-glow hover:bg-brand/20 transition-colors">
                <Activity className="w-3 h-3" /> 接口列表
              </Link>
              <Link to="/history" className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-white/5 text-slate-300 hover:bg-white/10 transition-colors">
                <Clock className="w-3 h-3" /> 执行历史
              </Link>
              <Link to="/flows" className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-white/5 text-slate-300 hover:bg-white/10 transition-colors">
                <Workflow className="w-3 h-3" /> 编排
              </Link>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Bottom section: recent runs + projects ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        {/* Recent runs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <div className="font-medium text-white text-sm">最近执行</div>
            </div>
            <Link to="/history" className="text-[11px] text-brand-glow hover:underline">查看全部</Link>
          </div>
          {history.length === 0 ? (
            <div className="text-xs text-slate-500 py-4 text-center">
              暂无执行记录。
            </div>
          ) : (
            <div className="space-y-1">
              {lastFive.map((h) => (
                <Link
                  key={h.id}
                  to="/history"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-bg-hover/50 transition-colors text-xs"
                >
                  <MethodBadge method={h.method} />
                  <span className={`font-semibold w-10 text-center shrink-0 ${statusClass(h.status)}`}>
                    {h.status || "ERR"}
                  </span>
                  <span className="font-mono text-slate-300 truncate flex-1 min-w-0" title={h.url}>
                    {h.url}
                  </span>
                  <span className="text-slate-500 shrink-0 whitespace-nowrap">{h.durationMs}ms</span>
                  <span className="text-slate-600 shrink-0 whitespace-nowrap hidden sm:block">
                    {timeAgo(h.createdAt)}
                  </span>
                  {h.error && (
                    <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                  )}
                </Link>
              ))}
            </div>
          )}
        </motion.div>

        {/* Projects overview */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-slate-400" />
              <div className="font-medium text-white text-sm">项目概况</div>
            </div>
            <Link to="/projects" className="text-[11px] text-brand-glow hover:underline">管理</Link>
          </div>
          {projects.length === 0 ? (
            <div className="text-xs text-slate-500 py-4 text-center">
              暂无项目，<Link to="/projects" className="text-brand-glow">去创建一个</Link>。
            </div>
          ) : (
            <div className="space-y-1">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-bg-hover/50 transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: p.color || "#6b7280" }}
                    />
                    <div className="text-sm text-white truncate">{p.name}</div>
                    {p.description && (
                      <div className="text-xs text-slate-500 truncate hidden sm:block">{p.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 shrink-0">
                    <span>{p._count?.endpoints ?? 0} 接口</span>
                    <span>{p.environments?.length ?? 0} 环境</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Step({ n, done, children }: { n: number; done?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={`mt-0.5 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0 ${
          done
            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
            : "bg-bg-elevated text-slate-400 border border-white/5"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <span className={done ? "text-slate-300" : "text-slate-400"}>{children}</span>
    </li>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}
