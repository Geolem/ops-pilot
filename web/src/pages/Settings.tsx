import { Github, Server, Info } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="p-8 space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-white">设置</h1>
        <p className="text-sm text-slate-400 mt-1">关于 OpsPilot 和当前实例的信息。</p>
      </div>

      <div className="card p-5 space-y-2">
        <div className="flex items-center gap-2 text-slate-300">
          <Info className="w-4 h-4" />
          <span className="font-medium">关于</span>
        </div>
        <div className="text-sm text-slate-400 leading-relaxed">
          OpsPilot 是一个本地/自托管的可视化运维小助手，用于统一管理不同项目、环境下的 HTTP 接口，并支持多接口串联编排。
          所有数据保存在服务器本地 SQLite 文件中。
        </div>
      </div>

      <div className="card p-5 space-y-2">
        <div className="flex items-center gap-2 text-slate-300">
          <Server className="w-4 h-4" />
          <span className="font-medium">部署信息</span>
        </div>
        <div className="text-sm text-slate-400">
          服务端口：<code className="text-brand-glow">5174</code>（生产）/ <code className="text-brand-glow">5173</code>（开发前端）。
          可通过 <code className="text-brand-glow">docker compose up -d</code> 一键部署。
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
