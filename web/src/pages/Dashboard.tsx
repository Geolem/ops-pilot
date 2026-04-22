import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Boxes, Activity, Workflow, Zap, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { api, Project } from "@/lib/api";
import { useAppStore } from "@/store/app";

export default function DashboardPage() {
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get<Project[]>("/api/projects"),
  });
  const { activeProjectId, activeEnvironmentId } = useAppStore();
  const active = projects.find((p) => p.id === activeProjectId);

  const totalEndpoints = projects.reduce((acc, p) => acc + (p._count?.endpoints ?? 0), 0);
  const totalFlows = projects.reduce((acc, p) => acc + (p._count?.flows ?? 0), 0);

  const stats = [
    { label: "项目数", value: projects.length, icon: Boxes, color: "from-brand to-accent" },
    { label: "接口总数", value: totalEndpoints, icon: Activity, color: "from-fuchsia-500 to-rose-400" },
    { label: "编排数", value: totalFlows, icon: Workflow, color: "from-amber-400 to-orange-500" },
  ];

  return (
    <div className="p-8 space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-between"
      >
        <div>
          <h1 className="text-2xl font-semibold text-white">欢迎回来 👋</h1>
          <p className="text-slate-400 text-sm mt-1">
            在这里集中管理你的项目、环境和运维接口，告别手搓 curl。
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          服务运行中
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card p-5 relative overflow-hidden group"
          >
            <div
              className={`absolute -top-6 -right-6 w-24 h-24 rounded-full bg-gradient-to-br ${s.color} opacity-20 blur-2xl group-hover:opacity-40 transition-opacity`}
            />
            <div className="flex items-center gap-3 text-slate-400 text-sm">
              <s.icon className="w-4 h-4" />
              {s.label}
            </div>
            <div className="text-3xl font-semibold text-white mt-2 tracking-tight">{s.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" />
              <div className="font-medium text-white">快速开始</div>
            </div>
          </div>
          <ol className="space-y-3 text-sm text-slate-300">
            <Step n={1} done={projects.length > 0}>
              在 <Link to="/projects" className="text-brand-glow underline-offset-2 hover:underline">项目</Link> 里新建一个项目
            </Step>
            <Step n={2} done={!!active?.environments?.length}>
              为项目添加至少一个环境（dev / test / prod），填写 baseUrl
            </Step>
            <Step n={3} done={!!activeEnvironmentId}>
              在顶部切换到目标项目和环境
            </Step>
            <Step n={4} done={totalEndpoints > 0}>
              去 <Link to="/endpoints" className="text-brand-glow underline-offset-2 hover:underline">接口</Link> 创建接口模板并执行
            </Step>
            <Step n={5} done={totalFlows > 0}>
              将多个接口串成 <Link to="/flows" className="text-brand-glow underline-offset-2 hover:underline">编排</Link>，自动传参
            </Step>
          </ol>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="card p-5"
        >
          <div className="font-medium text-white mb-4">最近的项目</div>
          {projects.length === 0 ? (
            <div className="text-sm text-slate-500">暂无项目，<Link to="/projects" className="text-brand-glow">去创建一个</Link>。</div>
          ) : (
            <div className="space-y-2">
              {projects.slice(0, 5).map((p) => (
                <Link
                  key={p.id}
                  to="/projects"
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-bg-hover/60 transition-colors group"
                >
                  <div>
                    <div className="text-sm text-white">{p.name}</div>
                    {p.description && <div className="text-xs text-slate-500">{p.description}</div>}
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function Step({ n, done, children }: { n: number; done?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-medium shrink-0 ${
          done ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-bg-elevated text-slate-400 border border-white/5"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <span className={done ? "text-slate-300" : "text-slate-400"}>{children}</span>
    </li>
  );
}
